// Field set shared between edit and create card forms.
import ImageDropZone from "./image-drop-zone";

interface CardDefaults {
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  shopifyCategoryId?: string;
  status?: string;
  player?: string;
  setName?: string;
  year?: string | number;
  cardNumber?: string;
  variantName?: string;
  grader?: string;
  grade?: string | number;
  certNumber?: string;
  sport?: string;
  league?: string;
  team?: string;
  condition?: string;
  tags?: string;
  imageUrls?: string;
  sku?: string;
  quantity?: string | number;
  price?: string | number;
}

export default function CardFormFields({ defaults = {} }: { defaults?: CardDefaults }) {
  const f = defaults;
  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-5">
      <Section title="Listing">
        <Field label="Title" required>
          <input name="title" defaultValue={f.title ?? ""} required className={inputClass} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={(f.status ?? "ACTIVE") as string} className={inputClass}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Vendor">
          <input name="vendor" defaultValue={f.vendor ?? ""} className={inputClass} />
        </Field>
        <Field label="Product type">
          <input name="productType" defaultValue={f.productType ?? ""} className={inputClass} />
        </Field>
        <Field label="Category (Shopify Taxonomy GID)" full>
          <input
            name="shopifyCategoryId"
            defaultValue={f.shopifyCategoryId ?? ""}
            placeholder="gid://shopify/TaxonomyCategory/..."
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Find this in Shopify admin → product page → Category field. Paste the GID. Leave blank to skip.
          </p>
        </Field>
        <Field label="Tags (comma-separated)">
          <input name="tags" defaultValue={f.tags ?? ""} className={inputClass} />
        </Field>
        <Field label="Description (HTML allowed)" full>
          <textarea
            name="descriptionHtml"
            defaultValue={f.descriptionHtml ?? ""}
            rows={6}
            className={inputClass}
          />
        </Field>
        <Field label="Images" full>
          <ImageDropZone defaultValue={f.imageUrls ?? ""} />
        </Field>
      </Section>

      <Section title="Card details">
        <Field label="Player">
          <input name="player" defaultValue={f.player ?? ""} className={inputClass} />
        </Field>
        <Field label="Set">
          <input name="setName" defaultValue={f.setName ?? ""} className={inputClass} />
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
          <input name="cardNumber" defaultValue={f.cardNumber ?? ""} className={inputClass} />
        </Field>
        <Field label="Variant">
          <input name="variantName" defaultValue={f.variantName ?? ""} className={inputClass} />
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
          <input name="certNumber" defaultValue={f.certNumber ?? ""} className={inputClass} />
        </Field>
        <Field label="Sport">
          <input name="sport" defaultValue={f.sport ?? ""} className={inputClass} />
        </Field>
        <Field label="League">
          <input name="league" defaultValue={f.league ?? ""} className={inputClass} />
        </Field>
        <Field label="Team">
          <input name="team" defaultValue={f.team ?? ""} className={inputClass} />
        </Field>
        <Field label="Condition">
          <input
            name="condition"
            placeholder="(ungraded only) Mint / NM / EX"
            defaultValue={f.condition ?? ""}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Variant & price">
        <Field label="SKU">
          <input name="sku" defaultValue={f.sku ?? ""} className={inputClass} />
        </Field>
        <Field label="Quantity">
          <input
            name="quantity"
            type="number"
            min="0"
            defaultValue={f.quantity?.toString() ?? "1"}
            className={inputClass}
          />
          <p className="text-xs text-gray-500 mt-1">
            Most graded cards are 1-of-1. Change for sealed boxes / multi-stock items.
          </p>
        </Field>
        <Field label="Price (USD)" required>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={f.price?.toString() ?? ""}
            className={inputClass}
          />
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
