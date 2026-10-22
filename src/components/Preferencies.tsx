"use client";

import { useState } from "react";
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { GALETA_MENU, GALETA_TEMA, type Menu, type Tema } from "@/lib/preferencies";

function desa(nom: string, valor: string) {
  document.cookie = `${nom}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

// Botons del peu del menú: plegar/desplegar el menú i mode clar/fosc.
// Canvien l'atribut de <html> a l'instant i ho recorden en una galeta.
export function Preferencies({ tema: inicialTema, menu: inicialMenu }: { tema: Tema; menu: Menu }) {
  const [tema, setTema] = useState(inicialTema);
  const [menu, setMenu] = useState(inicialMenu);

  const canviaTema = () => {
    const nou: Tema = tema === "fosc" ? "clar" : "fosc";
    document.documentElement.dataset.tema = nou;
    desa(GALETA_TEMA, nou);
    setTema(nou);
  };
  const canviaMenu = () => {
    const nou: Menu = menu === "plegat" ? "desplegat" : "plegat";
    document.documentElement.dataset.menu = nou;
    desa(GALETA_MENU, nou);
    setMenu(nou);
  };

  const textTema = tema === "fosc" ? "mode clar" : "mode fosc";
  const textMenu = menu === "plegat" ? "desplega el menú" : "plega el menú";
  return (
    <>
      <button type="button" onClick={canviaTema} aria-label={textTema} title={textTema} className="pref-tema">
        {tema === "fosc" ? <Sun className="icona" aria-hidden /> : <Moon className="icona" aria-hidden />}
      </button>
      <button type="button" onClick={canviaMenu} aria-label={textMenu} title={textMenu} className="pref-menu">
        {menu === "plegat" ? <PanelLeftOpen className="icona" aria-hidden /> : <PanelLeftClose className="icona" aria-hidden />}
      </button>
    </>
  );
}
