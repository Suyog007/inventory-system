"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCard, type CardActionResult } from "../../actions";
import CardFormFields from "../../card-form-fields";
import ChannelCheckboxList from "../../channel-checkbox-list";

interface Channel {
  id: string;
  channel: string;
  shopDomain: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface ActiveListingInfo {
  channelConnectionId: string;
  externalId: string;
  externalUrl: string | null;
}

interface PricingProfile {
  id: string;
  name: string;
}

interface Props {
  cardId: string;
  channels: Channel[];
  categories: Category[];
  pricingProfiles: PricingProfile[];
  activeChannelIds: string[];
  activeListings: ActiveListingInfo[];
  basePrice: number;
  priceAdjustments: Record<string, number>;
  defaults: Parameters<typeof CardFormFields>[0]["defaults"];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export default function EditCardForm({
  cardId,
  channels,
  categories,
  pricingProfiles,
  activeChannelIds,
  activeListings,
  basePrice,
  priceAdjustments,
  defaults,
}: Props) {
  const boundAction = updateCard.bind(null, cardId);
  const [result, formAction] = useActionState<CardActionResult, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <CardFormFields
          defaults={defaults}
          categories={categories}
          pricingProfiles={pricingProfiles}
        />

        {result && "error" in result && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
            {result.error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <a
            href={`/cards/${cardId}`}
            className="text-gray-600 hover:underline"
          >
            Cancel
          </a>
        </div>
      </div>
      <div className="lg:col-span-1">
        <ChannelCheckboxList
          channels={channels}
          defaultSelectedIds={activeChannelIds}
          basePrice={basePrice}
          priceAdjustments={priceAdjustments}
          activeListings={activeListings}
        />
      </div>
    </form>
  );
}
