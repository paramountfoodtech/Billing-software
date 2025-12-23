"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Client {
  id: string
  name: string
}

interface ClientSelectorProps {
  clients: Client[]
  selectedClientId: string | null
  onClientChange: (clientId: string | null) => void
}

export function ClientSelector({ clients, selectedClientId, onClientChange }: ClientSelectorProps) {
  return (
    <div className="w-full md:w-64">
      <Select value={selectedClientId || "all"} onValueChange={(value) => onClientChange(value === "all" ? null : value)}>
        <SelectTrigger>
          <SelectValue placeholder="Select a client..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
