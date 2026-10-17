import type { Metadata } from "next";
import { DelegationRegistryView } from "@/components/delegations/delegation-registry-view";

export const metadata: Metadata = { title: "Ủy quyền tác nghiệp" };

export default function DelegationsPage() {
  return <DelegationRegistryView />;
}
