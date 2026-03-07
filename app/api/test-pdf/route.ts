import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('Creating PDF document...');
    
    // Create a simple PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    console.log('Adding content...');
    
    doc
      .fontSize(24)
      .text('Test PDF', { align: 'center' })
      .moveDown()
      .fontSize(12)
      .text('This is a test PDF to verify pdfkit is working.');

    doc.end();

    console.log('Converting to buffer...');
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of doc as unknown as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    console.log(`PDF created successfully, size: ${pdfBuffer.length} bytes`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test.pdf"',
      },
    });
  } catch (error) {
    console.error('Error creating PDF:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
