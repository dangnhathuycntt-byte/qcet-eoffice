import React from "react";
import { AdvancedFilterPopover } from "qcet-eoffice";

export function BoLocNangCao() {
  const [criteria, setCriteria] = React.useState({});

  return (
    <div style={{ width: 440, padding: 20 }}>
      <AdvancedFilterPopover
        criteria={criteria}
        onApply={(newCriteria) => setCriteria(newCriteria)}
        onReset={() => setCriteria({})}
      />
    </div>
  );
}
