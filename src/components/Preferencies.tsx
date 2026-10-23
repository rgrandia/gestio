"use client";

import { useEffect, useState } from "react";
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { desaPreferencia } from "@/lib/accions";
import { GALETA_MENU, GALETA_TEMA, type Menu, type Tema } from "@/lib/preferencies";

function desaGaleta(nom: string, valor: string) {
  document.cookie = `${nom}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

// Botons del peu del menú: plegar/desplegar el menú i mode clar/fosc.
// Canvien l'atribut de <html> a l'instant, ho recorden en una galeta (perquè
// la pàgina es pinti bé de seguida) i ho desen al perfil (perquè us segueixi
// a qualsevol ordinador). En un ordinador nou, el que hi ha al perfil mana.
export function Preferencies({
  tema: temaGaleta,
  menu: menuGaleta,
  temaDesat,
  menuDesat,
}: {
  tema: Tema;
  menu: Menu;
  temaDesat: Tema | null;
  menuDesat: Menu | null;
}) {
  const [tema, setTema] = useState<Tema>(temaDesat ?? temaGaleta);
  const [menu, setMenu] = useState<Menu>(menuDesat ?? menuGaleta);

  // Aplica el que hi ha al perfil si la galeta d'aquest navegador diu una altra cosa.
  useEffect(() => {
    if (temaDesat && temaDesat !== temaGaleta) {
      document.documentElement.dataset.tema = temaDesat;
      desaGaleta(GALETA_TEMA, temaDesat);
    }
    if (menuDesat && menuDesat !== menuGaleta) {
      document.documentElement.dataset.menu = menuDesat;
      desaGaleta(GALETA_MENU, menuDesat);
    }
  }, [temaDesat, menuDesat, temaGaleta, menuGaleta]);

  const canviaTema = () => {
    const nou: Tema = tema === "fosc" ? "clar" : "fosc";
    document.documentElement.dataset.tema = nou;
    desaGaleta(GALETA_TEMA, nou);
    setTema(nou);
    void desaPreferencia("tema", nou);
  };
  const canviaMenu = () => {
    const nou: Menu = menu === "plegat" ? "desplegat" : "plegat";
    document.documentElement.dataset.menu = nou;
    desaGaleta(GALETA_MENU, nou);
    setMenu(nou);
    void desaPreferencia("menu", nou);
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
