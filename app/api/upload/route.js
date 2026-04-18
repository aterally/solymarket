import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Store base64 images directly — for production use Cloudinary/S3
// This stores a data URL in the DB, max ~500KB
export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dataUrl, type } = await req.json();
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return NextResponse.json({ error: 'Invalid image' }, { status: 400 });

  // Rough size check — base64 of 500KB image is ~680KB string
  if (dataUrl.length > 700000) return NextResponse.json({ error: 'Image too large (max ~500KB)' }, { status: 400 });

  if (type === 'avatar') {
    await sql`UPDATE users SET custom_image = ${dataUrl} WHERE email = ${session.user.email}`;
    return NextResponse.json({ ok: true, url: dataUrl });
  }

  // For comment images — just return the dataUrl, caller will pass it to comment POST
  return NextResponse.json({ ok: true, url: dataUrl });
}
