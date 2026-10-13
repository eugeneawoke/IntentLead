"use client";

import { Home, Layers3, SearchCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth/UserContext";
import { useLang } from "@/lib/i18n/LangContext";
import { landingCopy } from "./opportunity-landing-copy";

function scrollToSection(id: string) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

export function SignalDock() {
  const { lang } = useLang();
  const copy = landingCopy[lang];
  const router = useRouter();
  const user = useUser();
  const items = [
    { id: "hero", label: copy.dock.home, Icon: Home },
    { id: "method", label: copy.dock.method, Icon: Layers3 },
    { id: "example", label: copy.dock.example, Icon: SearchCheck },
  ];

  function start() {
    if (user) {
      router.push("/workspace/discovery");
      return;
    }
    scrollToSection("hero");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent<string>("composer-shimmer", { detail: "hero" }));
    }, reducedMotion ? 0 : 380);
  }

  return (
    <nav className="legacy-dock" aria-label="Landing sections">
      <div className="legacy-dock-bar">
        {items.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => scrollToSection(id)} className="legacy-dock-button" aria-label={label}>
            <Icon size={19} strokeWidth={2.1} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" onClick={start} className="legacy-dock-button" aria-label={copy.dock.start}>
          <Sparkles size={19} strokeWidth={2.1} aria-hidden="true" />
          <span>{copy.dock.start}</span>
        </button>
      </div>
    </nav>
  );
}
