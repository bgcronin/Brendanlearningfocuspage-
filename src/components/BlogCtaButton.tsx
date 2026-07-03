// src/components/BlogCtaButton.tsx
import React from "react";

interface BlogCtaButtonProps {
  href: string;
  buttonText: string;
}

export default function BlogCtaButton({
  href = "/contact",
  buttonText = "Book Appointment",
}: BlogCtaButtonProps) {
  const isExternal = href.startsWith("http");

  return (
    <div className="cta-wrapper">
      <a
        href={href}
        className="blog-cta-btn"
        target={isExternal ? "_blank" : "_self"}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {buttonText}
      </a>
    </div>
  );
}
