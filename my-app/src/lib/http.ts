import { NextResponse } from 'next/server';

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}

export function internalError(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 500 });
}
