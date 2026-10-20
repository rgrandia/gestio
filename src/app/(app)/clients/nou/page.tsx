import { membres, obtePerfils } from "@/lib/dades";
import { creaClient } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { CampsClient } from "../CampsClient";

export default async function NouClient() {
  const perfils = await obtePerfils();
  return (
    <>
      <h1>nou client</h1>
      <Formulari accio={creaClient} boto="crear client">
        <CampsClient perfils={membres(perfils)} />
      </Formulari>
    </>
  );
}
