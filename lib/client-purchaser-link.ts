import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestPurchaserCode } from "@/lib/purchase-document-numbers";
import { canCreate } from "@/lib/permissions";

export type LinkableOption = {
  id: string;
  name: string;
  label: string;
};

type ContactFields = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  notes?: string | null;
};

function assertCanManageLinks(role?: string | null) {
  if (!canCreate(role)) {
    throw new Error(
      "Only admins can create or link client–purchaser dual-role records.",
    );
  }
}

/** Clear bidirectional link without deleting either record. */
export async function unlinkClientPurchaser(
  supabase: SupabaseClient,
  options: {
    clientId?: string | null;
    purchaserId?: string | null;
    organizationId?: string | null;
  },
) {
  const clientId = options.clientId || null;
  const purchaserId = options.purchaserId || null;
  const organizationId = options.organizationId || null;

  if (clientId) {
    let clientQuery = supabase
      .from("clients")
      .select("id, linked_purchaser_id, organization_id")
      .eq("id", clientId);
    if (organizationId) {
      clientQuery = clientQuery.eq("organization_id", organizationId);
    }
    const { data: client } = await clientQuery.maybeSingle();

    if (client?.linked_purchaser_id) {
      let purchaserClear = supabase
        .from("purchasers")
        .update({ linked_client_id: null, updated_at: new Date().toISOString() })
        .eq("id", client.linked_purchaser_id);
      if (organizationId) {
        purchaserClear = purchaserClear.eq("organization_id", organizationId);
      }
      await purchaserClear;
    }

    if (client) {
      let clientClear = supabase
        .from("clients")
        .update({ linked_purchaser_id: null })
        .eq("id", clientId);
      if (organizationId) {
        clientClear = clientClear.eq("organization_id", organizationId);
      }
      await clientClear;
    }
  }

  if (purchaserId) {
    let purchaserQuery = supabase
      .from("purchasers")
      .select("id, linked_client_id, organization_id")
      .eq("id", purchaserId);
    if (organizationId) {
      purchaserQuery = purchaserQuery.eq("organization_id", organizationId);
    }
    const { data: purchaser } = await purchaserQuery.maybeSingle();

    if (purchaser?.linked_client_id) {
      let clientClear = supabase
        .from("clients")
        .update({ linked_purchaser_id: null })
        .eq("id", purchaser.linked_client_id);
      if (organizationId) {
        clientClear = clientClear.eq("organization_id", organizationId);
      }
      await clientClear;
    }

    if (purchaser) {
      let purchaserClear = supabase
        .from("purchasers")
        .update({ linked_client_id: null, updated_at: new Date().toISOString() })
        .eq("id", purchaserId);
      if (organizationId) {
        purchaserClear = purchaserClear.eq("organization_id", organizationId);
      }
      await purchaserClear;
    }
  }
}

/** Set bidirectional link (1:1). Requires same organization on both records. */
export async function linkClientAndPurchaser(
  supabase: SupabaseClient,
  clientId: string,
  purchaserId: string,
  organizationId: string,
  role?: string | null,
) {
  assertCanManageLinks(role);

  const [{ data: client }, { data: purchaser }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, organization_id")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("purchasers")
      .select("id, organization_id")
      .eq("id", purchaserId)
      .maybeSingle(),
  ]);

  if (!client || !purchaser) {
    throw new Error("Client or purchaser not found.");
  }

  if (
    client.organization_id !== organizationId ||
    purchaser.organization_id !== organizationId ||
    client.organization_id !== purchaser.organization_id
  ) {
    throw new Error("Client and purchaser must belong to the same organization.");
  }

  await unlinkClientPurchaser(supabase, {
    clientId,
    purchaserId,
    organizationId,
  });

  const { error: clientError } = await supabase
    .from("clients")
    .update({ linked_purchaser_id: purchaserId })
    .eq("id", clientId)
    .eq("organization_id", organizationId);
  if (clientError) throw clientError;

  const { error: purchaserError } = await supabase
    .from("purchasers")
    .update({
      linked_client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchaserId)
    .eq("organization_id", organizationId);

  if (purchaserError) {
    // Roll back client link to avoid half-linked state
    await supabase
      .from("clients")
      .update({ linked_purchaser_id: null })
      .eq("id", clientId)
      .eq("organization_id", organizationId);
    throw purchaserError;
  }
}

export async function createPurchaserFromClientContact(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  contact: ContactFields,
  role?: string | null,
): Promise<string> {
  assertCanManageLinks(role);

  const { data: existing } = await supabase
    .from("purchasers")
    .select("purchaser_code")
    .eq("organization_id", organizationId);

  const purchaser_code = suggestPurchaserCode(
    (existing || []).map((p) => p.purchaser_code),
  );

  const { data, error } = await supabase
    .from("purchasers")
    .insert({
      purchaser_code,
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      address: contact.address || null,
      city: contact.city || null,
      state: contact.state || null,
      zip_code: contact.zip_code || null,
      country: contact.country || "India",
      notes: contact.notes || null,
      organization_id: organizationId,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Failed to create purchaser");
  return data.id;
}

export async function createClientFromPurchaserContact(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  contact: ContactFields,
  role?: string | null,
): Promise<string> {
  assertCanManageLinks(role);

  const email = contact.email?.trim();
  if (!email) {
    throw new Error(
      "Email is required to create a client. Add an email on the purchaser first.",
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: contact.name,
      email,
      phone: contact.phone || null,
      address: contact.address || null,
      city: contact.city || null,
      state: contact.state || null,
      zip_code: contact.zip_code || null,
      country: contact.country || "India",
      notes: contact.notes || null,
      due_days: 30,
      due_days_type: "fixed_days",
      organization_id: organizationId,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Failed to create client");
  return data.id;
}

export async function fetchUnlinkedPurchasers(
  supabase: SupabaseClient,
  organizationId: string,
  _excludePurchaserId?: string | null,
): Promise<LinkableOption[]> {
  const { data, error } = await supabase
    .from("purchasers")
    .select("id, name, purchaser_code, linked_client_id")
    .eq("organization_id", organizationId)
    .order("name");

  if (error) throw error;

  return (data || [])
    .filter((p) => !p.linked_client_id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      label: `${p.name} (${p.purchaser_code})`,
    }));
}

export async function fetchUnlinkedClients(
  supabase: SupabaseClient,
  organizationId: string,
  _excludeClientId?: string | null,
): Promise<LinkableOption[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, linked_purchaser_id")
    .eq("organization_id", organizationId)
    .order("name");

  if (error) throw error;

  return (data || [])
    .filter((c) => !c.linked_purchaser_id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      label: c.email ? `${c.name} (${c.email})` : c.name,
    }));
}
