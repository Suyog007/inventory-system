import { SHOPIFY_API_VERSION } from "./config";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; [k: string]: unknown }>;
}

export class ShopifyClient {
  constructor(
    private readonly shop: string,
    private readonly accessToken: string,
  ) {}

  async graphql<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch(
      `https://${this.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Shopify GraphQL HTTP ${res.status}: ${await res.text()}`,
      );
    }
    const json = (await res.json()) as GraphQLResponse<T>;
    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    if (!json.data) {
      throw new Error("Shopify GraphQL returned no data");
    }
    return json.data;
  }
}
