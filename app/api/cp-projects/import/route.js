import { NextResponse } from 'next/server';

/**
 * API Route: POST /api/cp-projects/import
 * 
 * Handles Excel file upload and imports data into cp_projects collection
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sheets, mode, batchId } = body;

    if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
      return NextResponse.json(
        { error: 'No sheets provided' },
        { status: 400 }
      );
    }

    // Validation log
    console.log('📥 Received import request:');
    console.log(`   Mode: ${mode || 'add'}`);
    console.log(`   Sheets: ${sheets.length}`);
    console.log(`   Batch ID: ${batchId || 'none'}`);

    // Return success with prepared data
    // The actual import will happen on the client side using the service
    return NextResponse.json({
      success: true,
      message: 'Import data validated',
      sheets: sheets.map(s => ({
        name: s.sheetName,
        rows: s.rows?.length || 0,
        headers: s.headers?.length || 0
      }))
    });

  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { error: 'Failed to process import', message: error.message },
      { status: 500 }
    );
  }
}
