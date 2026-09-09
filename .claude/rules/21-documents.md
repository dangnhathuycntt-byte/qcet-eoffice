---
paths:
  - "src/components/documents/**/*"
  - "src/app/documents/**/*"
  - "src/lib/documents/**/*"
---
# Document Domain Invariants

1. **Canonical Registry & Detail**: Use single registry model and detail drawer for all document types. Never build separate detail pages.
2. **Directional Semantics**: Maintain strict distinction between incoming (`van_ban_den`) and outgoing (`van_ban_di`) document lifecycles and metadata.
3. **Authentic Metadata**: Use real document numbers, issuing entities, dates, and signers. Never invent synthetic document IDs or fake signatories.
4. **Server-Backed Authorization**: Access control, document classification, and signing authorities are validated strictly on the server.
5. **Canonical Document Viewer**: Always reuse the canonical PDF/document viewer component; never introduce parallel preview modals or ad-hoc file loaders.
