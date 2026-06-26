import { describe, it, expect } from "vitest";
import { parseShopifyCard } from "@/lib/parser";

// Fixtures lifted from the spike (real Shopify products on marketplacetest-6).

describe("parseShopifyCard — TEMPLATED_DESCRIPTION strategy", () => {
  const CHARLES_BARKLEY = {
    title: "2022 Panini Father's Day Charles Barkley #20 Holo PSA 10",
    productType: "Graded Sports Cards",
    descriptionHtml:
      "<p>Collectors Club - Located in Miami Florida... Player - Charles Barkley Card Number - #20 Set - 2022 Panini Father's Day Grader - PSA Grade - 10 Autograph Grade - Certification Number - 93074114 Grade Population - 2 Sport - Multi-Sport League - Team - See our Store for more items just like this.</p>",
  };

  it("extracts player, set, year, cardNumber, grader, grade, cert# from Mascot template", () => {
    const result = parseShopifyCard(CHARLES_BARKLEY);
    expect(result.parseSource).toBe("TEMPLATED_DESCRIPTION");
    expect(result.fields.player).toBe("Charles Barkley");
    expect(result.fields.cardNumber).toBe("#20");
    expect(result.fields.setName).toBe("Panini Father's Day");
    expect(result.fields.year).toBe(2022);
    expect(result.fields.grader).toBe("PSA");
    expect(result.fields.grade).toBe(10);
    expect(result.fields.certNumber).toBe("93074114");
    expect(result.fields.sport).toBe("Multi-Sport");
  });

  const CHRISTIAN_PACHE = {
    title: "2022 Panini National Vip Rookies Christian Pache #RC19 Giraffe PSA 10",
    productType: "Graded Sports Cards",
    descriptionHtml:
      "<p>Collectors Club - ... Player - Christian Pache Card Number - #RC19 Set - 2022 Panini National Vip Rookies Grader - PSA Grade - 10 Autograph Grade - Certification Number - 93074144 Grade Population - 3 Sport - Multi-Sport League - Team - See our Store for more items just like this.</p>",
  };

  it("handles a different graded card from the same template", () => {
    const result = parseShopifyCard(CHRISTIAN_PACHE);
    expect(result.parseSource).toBe("TEMPLATED_DESCRIPTION");
    expect(result.fields.player).toBe("Christian Pache");
    expect(result.fields.cardNumber).toBe("#RC19");
    expect(result.fields.setName).toBe("Panini National Vip Rookies");
    expect(result.fields.year).toBe(2022);
    expect(result.fields.certNumber).toBe("93074144");
  });

  it("handles half-grades (9.5)", () => {
    const result = parseShopifyCard({
      title: "Test card BGS 9.5",
      descriptionHtml:
        "Player - Test Player Card Number - #1 Set - 2020 Test Set Grader - BGS Grade - 9.5 Certification Number - 123",
    });
    expect(result.parseSource).toBe("TEMPLATED_DESCRIPTION");
    expect(result.fields.grade).toBe(9.5);
    expect(result.fields.grader).toBe("BGS");
  });

  it("strips HTML tags before parsing", () => {
    const result = parseShopifyCard({
      title: "Test",
      descriptionHtml:
        "<p><strong>Player</strong> - Mike Trout <br>Card Number - #1 <br>Set - 2020 Topps <br>Grader - PSA <br>Grade - 10 <br>Certification Number - 999</p>",
    });
    expect(result.parseSource).toBe("TEMPLATED_DESCRIPTION");
    expect(result.fields.player).toBe("Mike Trout");
    expect(result.fields.grade).toBe(10);
  });
});

describe("parseShopifyCard — TITLE_ONLY fallback", () => {
  it("extracts year, cardNumber, grader, grade from a clean title", () => {
    const result = parseShopifyCard({
      title: "2022 Pokemon Sword & Shield Silver Tempest Milotic #TG02 Silver Tempest Fa PSA 9",
      productType: "Graded TCG/CCG",
      // No templated description
      descriptionHtml: "<p>Just a plain description</p>",
    });
    expect(result.parseSource).toBe("TITLE_ONLY");
    expect(result.fields.year).toBe(2022);
    expect(result.fields.cardNumber).toBe("#TG02");
    expect(result.fields.grader).toBe("PSA");
    expect(result.fields.grade).toBe(9);
    // Title-only does NOT attempt to extract player/set (too ambiguous)
    expect(result.fields.player).toBeUndefined();
    expect(result.fields.setName).toBeUndefined();
  });

  it("handles half-grades from title", () => {
    const result = parseShopifyCard({
      title: "1986 Fleer Michael Jordan #57 RC BGS 9.5",
    });
    expect(result.parseSource).toBe("TITLE_ONLY");
    expect(result.fields.year).toBe(1986);
    expect(result.fields.grader).toBe("BGS");
    expect(result.fields.grade).toBe(9.5);
  });

  it("uppercases grader regardless of case in title", () => {
    const result = parseShopifyCard({
      title: "2020 Test Card #1 psa 10",
    });
    expect(result.fields.grader).toBe("PSA");
  });

  it("for sealed boxes, skips grader/grade extraction", () => {
    const result = parseShopifyCard({
      title: "2025 Topps Signature Class Football Hobby Box",
      productType: "Sealed Boxes",
    });
    expect(result.parseSource).toBe("TITLE_ONLY");
    expect(result.fields.year).toBe(2025);
    expect(result.fields.grader).toBeUndefined();
    expect(result.fields.grade).toBeUndefined();
  });
});

describe("parseShopifyCard — IMPORT_UNPARSED", () => {
  it("returns IMPORT_UNPARSED when nothing matches", () => {
    const result = parseShopifyCard({
      title: "Random product name with no patterns",
      descriptionHtml: "<p>Just text</p>",
    });
    expect(result.parseSource).toBe("IMPORT_UNPARSED");
    expect(result.fields).toEqual({});
  });
});
