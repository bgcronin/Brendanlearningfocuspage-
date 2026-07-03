// src/components/TreatmentPrice.tsx
import React from "react";
import siteData from "../data/site.json";

interface TreatmentPriceProps {
  treatmentName: string;
}

export default function TreatmentPrice({ treatmentName }: TreatmentPriceProps) {
  const treatment = siteData.treatments.find((t) =>
    t.name.toLowerCase().includes(treatmentName.toLowerCase()),
  );

  if (!treatment) {
    return <span className="treatment-price-error">Price not available</span>;
  }

  return <strong className="treatment-price">{treatment.price}</strong>;
}
