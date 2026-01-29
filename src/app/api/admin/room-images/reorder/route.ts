import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, images } = body;

    if (!roomId || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "Invalid request. roomId and images array are required." },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Update displayOrder for each image
    const updatePromises = images.map(
      async (image: { id: number; displayOrder: number }) => {
        const { error } = await supabase
          .from("RoomImage")
          .update({ displayOrder: image.displayOrder })
          .eq("id", image.id)
          .eq("roomId", roomId); // Security check to ensure image belongs to room

        if (error) {
          console.error("Error updating image order:", error);
          throw error;
        }
      },
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in reorder endpoint:", error);
    return NextResponse.json(
      {
        error: "Failed to update image order",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
