import { NextRequest, NextResponse } from "next/server";
import { validateWithScreenshot } from "@/lib/matching";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const requestId = formData.get("requestId") as string;
    const file = formData.get("screenshot") as File | null;

    if (!requestId || !file) {
      return NextResponse.json(
        { error: "requestId and screenshot file are required" },
        { status: 400 }
      );
    }

    // Basic validation
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image (jpg, png, webp)" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large (max 8 MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const result = await validateWithScreenshot(requestId, base64, mimeType);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("validate-screenshot error:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}