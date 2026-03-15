import { ciiu0103AgroPresetV1 } from "@/modules/accounting/presets/activity/ciiu-01-03-agro.v1";
import { ciiu28LightManufacturingPresetV1 } from "@/modules/accounting/presets/activity/ciiu-28-light-manufacturing.v1";
import { ciiu33RepairInstallationPresetV1 } from "@/modules/accounting/presets/activity/ciiu-33-repair-installation.v1";
import { ciiu46WholesaleEquipmentPresetV1 } from "@/modules/accounting/presets/activity/ciiu-46-wholesale-equipment.v1";
import { ciiu47RetailPresetV1 } from "@/modules/accounting/presets/activity/ciiu-47-retail.v1";
import { uyBaseSaGeneralPresetV1 } from "@/modules/accounting/presets/base/uy-base-sa-general.v1";
import { traitExporterPresetV1 } from "@/modules/accounting/presets/traits/exporter.v1";
import { traitImporterPresetV1 } from "@/modules/accounting/presets/traits/importer.v1";
import { traitMixedVatPresetV1 } from "@/modules/accounting/presets/traits/mixed-vat.v1";
import { traitMultiCurrencyPresetV1 } from "@/modules/accounting/presets/traits/multi-currency.v1";
import { traitPublicTendersPresetV1 } from "@/modules/accounting/presets/traits/tenders-public-sector.v1";
import { traitRecurringServicesPresetV1 } from "@/modules/accounting/presets/traits/recurring-services.v1";
import type { PresetBundle } from "@/modules/accounting/presets/types";

const presetCatalog = [
  uyBaseSaGeneralPresetV1,
  ciiu46WholesaleEquipmentPresetV1,
  ciiu33RepairInstallationPresetV1,
  ciiu47RetailPresetV1,
  ciiu0103AgroPresetV1,
  ciiu28LightManufacturingPresetV1,
  traitImporterPresetV1,
  traitExporterPresetV1,
  traitMixedVatPresetV1,
  traitMultiCurrencyPresetV1,
  traitRecurringServicesPresetV1,
  traitPublicTendersPresetV1,
] satisfies PresetBundle[];

const presetByCode = new Map(presetCatalog.map((preset) => [preset.code, preset]));

export function listPresetBundles() {
  return presetCatalog;
}

export function getPresetBundleByCode(code: string) {
  return presetByCode.get(code) ?? null;
}
