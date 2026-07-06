// Field set shared between edit and create card forms.
import ImageDropZone from "./image-drop-zone";
import MarketplaceSection from "./marketplace-section";

interface CardDefaults {
  vendor?: string;
  manufacturer?: string;
  categoryId?: string;
  player?: string;
  setName?: string;
  year?: string | number;
  cardNumber?: string;
  variantName?: string;
  grader?: string;
  grade?: string | number;
  certNumber?: string;
  autographAuthentication?: string;
  autographGrade?: string | number;
  population?: string | number;
  populationHigher?: string | number;
  rarity?: string;
  tcgplayerId?: string;
  game?: string;
  sport?: string;
  league?: string;
  team?: string;
  condition?: string;
  tags?: string;
  imageUrls?: string;
  sku?: string;
  quantity?: string | number;
  listingPrice?: string | number;
  purchaseDate?: string;
  purchasedFrom?: string;
  itemCost?: string | number;
  useTitleTemplate?: boolean;
  useDescriptionTemplate?: boolean;
  titleOverride?: string;
  descriptionHtmlOverride?: string;
  pricingProfileId?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface PricingProfileOption {
  id: string;
  name: string;
}

interface Props {
  defaults?: CardDefaults;
  categories: CategoryOption[];
  pricingProfiles?: PricingProfileOption[];
}

export default function CardFormFields({
  defaults = {},
  categories,
  pricingProfiles = [],
}: Props) {
  const f = defaults;
  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-5">
      <MarketplaceSection
        defaultUseTitleTemplate={f.useTitleTemplate ?? true}
        defaultUseDescriptionTemplate={f.useDescriptionTemplate ?? true}
        defaultTitleOverride={f.titleOverride ?? ""}
        defaultDescriptionOverride={f.descriptionHtmlOverride ?? ""}
      />

      <Section title="Listing">
        <Field label="Category" required>
          <select
            name="categoryId"
            required
            defaultValue={f.categoryId ?? ""}
            className={inputClass}
          >
            <option value="">-- pick a category --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Manufacturer">
          <input
            name="manufacturer"
            defaultValue={f.manufacturer ?? ""}
            placeholder="Panini, Topps, Upper Deck, …"
            className={inputClass}
          />
        </Field>
        <Field label="Vendor (Shopify)">
          <input
            name="vendor"
            defaultValue={f.vendor ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <input name="tags" defaultValue={f.tags ?? ""} className={inputClass} />
        </Field>
        <Field label="Images" full>
          <ImageDropZone defaultValue={f.imageUrls ?? ""} />
        </Field>
      </Section>

      <Section title="Card details">
        <Field label="Player">
          <input
            name="player"
            defaultValue={f.player ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Set">
          <input
            name="setName"
            defaultValue={f.setName ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Year">
          <input
            name="year"
            type="number"
            min="1800"
            max="2100"
            defaultValue={f.year?.toString() ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Card #">
          <input
            name="cardNumber"
            defaultValue={f.cardNumber ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Parallel / Variety">
          <input
            name="variantName"
            defaultValue={f.variantName ?? ""}
            placeholder="Holo, Refractor, Blue, …"
            className={inputClass}
          />
        </Field>
        <Field label="Grader">
          <input
            name="grader"
            placeholder="PSA / BGS / CGC / SGC / MBA"
            defaultValue={f.grader ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Grade">
          <input
            name="grade"
            type="number"
            step="0.5"
            min="0"
            max="10"
            defaultValue={f.grade?.toString() ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Cert #">
          <input
            name="certNumber"
            defaultValue={f.certNumber ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Autograph Authentication">
          <input
            name="autographAuthentication"
            placeholder="PSA/DNA, JSA, Beckett, …"
            defaultValue={f.autographAuthentication ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Autograph Grade">
          <input
            name="autographGrade"
            type="number"
            step="0.5"
            min="0"
            max="10"
            defaultValue={f.autographGrade?.toString() ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Population">
          <input
            name="population"
            type="number"
            min="0"
            defaultValue={f.population?.toString() ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Population Higher">
          <input
            name="populationHigher"
            type="number"
            min="0"
            defaultValue={f.populationHigher?.toString() ?? ""}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Auto-populated in a later slice.
          </p>
        </Field>
        <Field label="Game (TCG)">
          <input
            name="game"
            placeholder="Pokémon, Magic, Yu-Gi-Oh, …"
            defaultValue={f.game ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Rarity (TCG)">
          <input
            name="rarity"
            placeholder="Rare, Ultra Rare, Secret Rare, …"
            defaultValue={f.rarity ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="TCGplayer ID">
          <input
            name="tcgplayerId"
            defaultValue={f.tcgplayerId ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Sport">
          <input
            name="sport"
            defaultValue={f.sport ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="League">
          <input
            name="league"
            defaultValue={f.league ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Team">
          <input
            name="team"
            defaultValue={f.team ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Condition (ungraded)">
          <input
            name="condition"
            placeholder="Mint / NM / EX"
            defaultValue={f.condition ?? ""}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Variant & pricing">
        <Field label="SKU (fallback)">
          <input
            name="sku"
            defaultValue={f.sku ?? ""}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Used when no SKU template applies. Graded cards auto-fill from cert #.
          </p>
        </Field>
        <Field label="Quantity">
          <input
            name="quantity"
            type="number"
            min="0"
            defaultValue={f.quantity?.toString() ?? "1"}
            className={inputClass}
          />
        </Field>
        <Field label="Listing price (USD)" required>
          <input
            name="listingPrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={f.listingPrice?.toString() ?? ""}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Base price. Per-channel prices are computed via pricing rules.
          </p>
        </Field>
        {pricingProfiles.length > 1 && (
          <Field label="Pricing profile">
            <select
              name="pricingProfileId"
              defaultValue={f.pricingProfileId ?? ""}
              className={inputClass}
            >
              <option value="">-- default --</option>
              {pricingProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Purchase date">
          <input
            name="purchaseDate"
            type="date"
            defaultValue={f.purchaseDate ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Purchased from">
          <input
            name="purchasedFrom"
            defaultValue={f.purchasedFrom ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Item cost (USD)">
          <input
            name="itemCost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={f.itemCost?.toString() ?? ""}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Syncs to Shopify's cost per item.
          </p>
        </Field>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
