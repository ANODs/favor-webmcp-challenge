import { createElement } from "react";
import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { getCategoryLabel } from "@/entities/category";
import {
  CONTRACT_OG_COVER_STATE,
  CONTRACT_OG_COVER_STATE_HEADER,
  getContractGradientStyle,
  getContractOgCacheControl,
  resolveLocalizedContractContent,
} from "@/entities/contract";
import { loadContractOgCoverImage } from "@/entities/contract/server";
import { prisma } from "@/shared/lib/prisma";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const requestedLocale = new URL(request.url).searchParams.get("locale");
    const locale = requestedLocale === "en" ? "en" : "ru";
    const t = await getTranslations({ locale, namespace: "Contracts" });

    const contract = await prisma.contract.findUnique({
      where: { slug },
      select: {
        titleRu: true,
        titleEn: true,
        descriptionRu: true,
        descriptionEn: true,
        mediaRefs: true,
        category: true,
        basePrice: true,
        deadlineDays: true,
      },
    });

    if (!contract) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { title } = resolveLocalizedContractContent(
      contract,
      locale,
      t("ContractNoTitle"),
    );
    const coverImage = await loadContractOgCoverImage(contract.mediaRefs);
    const coverImageDataUrl = coverImage.dataUrl;

    if (coverImage.state === CONTRACT_OG_COVER_STATE.unavailable) {
      console.warn("[contract-og-cover] image unavailable", {
        slug,
        imageHost: coverImage.imageHost,
        reason: coverImage.reason,
        responseStatus: coverImage.responseStatus,
        contentType: coverImage.contentType,
        errorName: coverImage.errorName,
        errorMessage: coverImage.errorMessage,
      });
    }

    const gradientStyle = getContractGradientStyle(slug);
    const facts = [
      getCategoryLabel(contract.category, locale) ?? contract.category,
      contract.basePrice ? `${contract.basePrice.toString()} $` : null,
      contract.deadlineDays
        ? t("DeadlineDays", { days: contract.deadlineDays })
        : null,
    ].filter((fact): fact is string => Boolean(fact));

    return new ImageResponse(
      createElement(
        "div",
        {
          style: {
            ...gradientStyle,
            alignItems: "stretch",
            color: "white",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            overflow: "hidden",
            padding: "64px",
            position: "relative",
            width: "100%",
          },
        },
        coverImageDataUrl
          ? createElement("img", {
              alt: "",
              height: 630,
              src: coverImageDataUrl,
              style: {
                height: "100%",
                objectFit: "cover",
                position: "absolute",
                right: 0,
                top: 0,
                width: "58%",
              },
              width: 696,
            })
          : createElement("div", {
              style: {
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: "999px",
                height: "460px",
                position: "absolute",
                right: "-110px",
                top: "-145px",
                width: "460px",
              },
            }),
        coverImageDataUrl
          ? createElement("div", {
              style: {
                background:
                  "linear-gradient(90deg, rgba(7, 12, 18, 0.98) 0%, rgba(7, 12, 18, 0.94) 34%, rgba(7, 12, 18, 0.58) 63%, rgba(7, 12, 18, 0.18) 100%)",
                height: "100%",
                left: 0,
                position: "absolute",
                top: 0,
                width: "100%",
              },
            })
          : null,
        createElement(
          "div",
          {
            style: {
              alignItems: "center",
              display: "flex",
              fontSize: "25px",
              fontWeight: 700,
              gap: "16px",
              position: "relative",
            },
          },
          createElement(
            "div",
            {
              style: {
                alignItems: "center",
                background: "rgba(0,0,0,0.24)",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: "22px",
                display: "flex",
                fontSize: "32px",
                height: "64px",
                justifyContent: "center",
                width: "64px",
              },
            },
            "F",
          ),
          "favor.deals",
        ),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "28px",
              maxWidth: "980px",
              position: "relative",
            },
          },
          createElement(
            "div",
            {
              style: {
                fontSize: title.length > 70 ? "54px" : "66px",
                fontWeight: 800,
                letterSpacing: "-2px",
                lineHeight: 1.08,
                textShadow: "0 8px 34px rgba(0,0,0,0.34)",
              },
            },
            title,
          ),
          facts.length > 0
            ? createElement(
                "div",
                { style: { display: "flex", gap: "14px" } },
                ...facts.map((fact) =>
                  createElement(
                    "div",
                    {
                      key: fact,
                      style: {
                        background: "rgba(0,0,0,0.28)",
                        border: "1px solid rgba(255,255,255,0.24)",
                        borderRadius: "999px",
                        fontSize: "22px",
                        fontWeight: 600,
                        padding: "12px 22px",
                      },
                    },
                    fact,
                  ),
                ),
              )
            : null,
        ),
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": getContractOgCacheControl(coverImage.state),
          [CONTRACT_OG_COVER_STATE_HEADER]: coverImage.state,
        },
      },
    );
  } catch (error) {
    console.error("Error serving OG image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
