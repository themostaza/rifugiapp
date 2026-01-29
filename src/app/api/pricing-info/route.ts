import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Recupera tutti i letti con i loro prezzi
    const { data: beds, error } = await supabase
      .from("Bed")
      .select("id, description, priceBandB, priceMP, peopleCount")
      .order("peopleCount", { ascending: true });

    if (error) {
      console.error("Error fetching pricing info:", error);
      return NextResponse.json(
        { error: "Failed to fetch pricing information" },
        { status: 500 },
      );
    }

    // Organizza i prezzi per tipologia
    const pricingInfo = {
      bb:
        beds?.map((bed) => ({
          description: bed.description,
          price: bed.priceBandB,
          peopleCount: bed.peopleCount,
        })) || [],
      mp:
        beds?.map((bed) => ({
          description: bed.description,
          price: bed.priceMP,
          peopleCount: bed.peopleCount,
        })) || [],
    };

    return NextResponse.json(pricingInfo);
  } catch (error) {
    console.error("Error in pricing-info API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
