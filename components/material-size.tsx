import { MAX_MATERIAL, MIN_MATERIAL, describeMaterial } from "@/lib/quiz";

// e.g. "4 files · 85,000 / 400,000 characters", with a warning when the
// material is too short or too long to generate a quiz from.
export function MaterialSize({
  id,
  material,
  extra,
}: {
  id: string;
  material: string;
  extra?: string;
}) {
  const length = material.trim().length;
  const over = length > MAX_MATERIAL;
  return (
    <p
      id={id}
      className={`mt-1 text-sm ${over ? "font-medium text-red-800" : "text-slate-600"}`}
    >
      {describeMaterial(material)}
      {over
        ? " · over the limit: remove some text or split it into two study sets to generate a quiz"
        : length < MIN_MATERIAL
          ? ` · at least ${MIN_MATERIAL} needed to generate a quiz`
          : ""}
      {extra}
    </p>
  );
}
