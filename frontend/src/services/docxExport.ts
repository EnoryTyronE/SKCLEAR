import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

export type Binary = ArrayBuffer | Uint8Array;

async function fetchBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load template: ${path}`);
  return await res.arrayBuffer();
}

export async function exportDocxFromTemplate(options: {
  templatePath: string;
  data: Record<string, any>;
  outputFileName: string;
}) {
  const { templatePath, data, outputFileName } = options;

  const content = await fetchBinary(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Use square bracket delimiters to avoid Word splitting curly braces
    delimiters: { start: '[[', end: ']]' },
  });
  doc.setData(data);
  try {
    doc.render();
  } catch (error: any) {
    console.error('Docx render error:', error);
    throw error;
  }
  const out = doc.getZip().generate({ type: 'blob' });
  saveAs(out, outputFileName.endsWith('.docx') ? outputFileName : `${outputFileName}.docx`);
}

// Helpers to shape CBYDP/ABYIP data into template-friendly format
export function mapCBYDPToTemplate(payload: any) {
  console.log('Mapping CBYDP data:', payload);
  
  const allMembers: any[] = payload?.form?.skMembers || [];
  console.log('All members:', allMembers);
  
  // Filter out the main officers (Secretary, Chairperson, Treasurer) to get councilors
  const councilors = allMembers.filter((m: any) => 
    m.position !== 'SK Secretary' && 
    m.position !== 'SK Chairperson' && 
    m.position !== 'SK Treasurer'
  );
  console.log('Councilors:', councilors);
  
  const memberRows = [] as Array<{ left: any; right?: any }>;
  for (let i = 0; i < councilors.length; i += 2) {
    memberRows.push({ 
      left: councilors[i] || { name: '', position: '' }, 
      right: councilors[i + 1] || null 
    });
  }
  console.log('Member rows:', memberRows);
  
  const result = {
    logo: payload?.skProfile?.logo || '',
    barangay: payload?.skProfile?.barangay || '',
    region: payload?.skProfile?.region || '',
    province: payload?.skProfile?.province || '',
    city: payload?.skProfile?.city || '',
    term_start: payload?.skProfile?.skTermStart || '',
    term_end: payload?.skProfile?.skTermEnd || '',
    member_rows: memberRows,
    centers: (payload?.form?.centers || []).map((c: any) => ({
      name: c.name || '',
      agenda: c.agenda || '',
      projects: (c.projects || []).map((p: any) => ({
        concern: p.concern || '',
        objective: p.objective || '',
        indicator: p.indicator || '',
        target1: p.target1 || '',
        target2: p.target2 || '',
        target3: p.target3 || '',
        ppas: p.ppas || '',
        expenses: (p.expenses || []).map((e: any) => ({ 
          description: e.description || '', 
          cost: e.cost || '' 
        })),
        responsible: p.responsible || '',
      })),
    })),
    prepared_by: {
      secretary: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Secretary')?.name || '',
      chairperson: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Chairperson')?.name || '',
      treasurer: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Treasurer')?.name || '',
    },
    sk_federation_president: (payload?.skProfile?.federationPresident || ''),
  };
  
  console.log('Final mapped data:', result);
  return result;
}

export function mapABYIPToTemplate(payload: any) {
  return {
    barangay: payload?.skProfile?.barangay || '',
    region: payload?.skProfile?.region || '',
    province: payload?.skProfile?.province || '',
    city: payload?.skProfile?.city || '',
    year: payload?.form?.year || '',
    centers: (payload?.form?.centers || []).map((c: any) => ({
      name: c.name || '',
      agenda: c.agenda || '',
      projects: (c.projects || []).map((p: any) => ({
        referenceCode: p.referenceCode || '',
        ppas: p.ppas || '',
        description: p.description || '',
        expectedResult: p.expectedResult || '',
        performanceIndicator: p.performanceIndicator || '',
        period: p.periodOfImplementation || '',
        mooe: p?.budget?.mooe || '',
        co: p?.budget?.co || '',
        ps: p?.budget?.ps || '',
        total: p?.budget?.total || '',
        responsible: p.personResponsible || '',
      })),
    })),
    prepared_by: {
      secretary: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Secretary')?.name || '',
      chairperson: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Chairperson')?.name || '',
      treasurer: (payload?.form?.skMembers || []).find((m: any) => m.position === 'SK Treasurer')?.name || '',
    },
  };
}


