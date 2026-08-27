const path = require('path');
const XLSX = require('xlsx');

const filePath = path.resolve(__dirname, 'Notes des evaluations', 'export_notesCC_2APIC-1_0030.xlsx');
const workbook = XLSX.readFile(filePath);
const ws = workbook.Sheets['NotesCC'];

console.log('Worksheet keys:', Object.keys(ws).filter(k => !k.startsWith('!')));
console.log('!ref:', ws['!ref']);
console.log('!merges:', JSON.stringify(ws['!merges']));
console.log('!cols:', JSON.stringify(ws['!cols']));
console.log('!rows:', JSON.stringify(ws['!rows']));

console.log('--- Inspect Header Cells ---');
['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'C7', 'D7', 'G7', 'I7', 'L7', 'O7', 'C9', 'D9', 'G9', 'I9', 'L9', 'C11', 'D11', 'L11', 'O11', 'C13', 'D13', 'A16', 'B16', 'C16', 'D16', 'F16', 'G16', 'I16', 'K16', 'M16', 'O16'].forEach(cell => {
  if (ws[cell]) {
    console.log(`${cell}:`, JSON.stringify(ws[cell]));
  }
});
