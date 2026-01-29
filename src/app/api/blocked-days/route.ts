import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Recupera tutti i giorni bloccati dall'admin
    const { data: blockedDays, error } = await supabase
      .from("day_blocked")
      .select("day_blocked")
      .order("day_blocked", { ascending: true });

    if (error) {
      console.error("Error fetching blocked days:", error);
      return NextResponse.json(
        { error: "Failed to fetch blocked days" },
        { status: 500 },
      );
    }

    // Restituisce un array di stringhe di date
    const dates = blockedDays?.map((day) => day.day_blocked) || [];

    return NextResponse.json({ blockedDays: dates });
  } catch (error) {
    console.error("Error in blocked-days API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
