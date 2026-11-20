import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
const prisma = new PrismaClient();
export async function POST(req: NextRequest){
 try{ const c=await cookies(); const mid=c.get("merchant_id")?.value||c.get("merchantId")?.value; if(!mid) return NextResponse.json({error:"Not logged in"},{status:401});
 const b=await req.json().catch(()=>({})); const data:any={}; if(b.gcashNumber) data.gcashNumber=b.gcashNumber; if(b.gcashName) data.gcashName=b.gcashName; if(b.pin) data.pin=b.pin;
 const u=await prisma.merchant.update({where:{id:mid},data}); return NextResponse.json({message:"Settings saved",merchant:u});
 }catch(e:any){ return NextResponse.json({error:e?.message||"Save failed"},{status:500}); }
}
