import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

export type Binary = ArrayBuffer | Uint8Array;

async function fetchBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load template: ${path}`);
  return await res.arrayBuffer();
}

// Function to inspect template content
export async function inspectTemplate() {
  console.log('=== INSPECTING TEMPLATE ===');
  
  try {
    const content = await fetchBinary('/templates/cbydp_template.docx');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
    });
    
    // Get the template content
    const templateFile = doc.getZip().file('word/document.xml');
    if (!templateFile) {
      console.error('Template file not found');
      return;
    }
    const templateContent = templateFile.asText();
    console.log('Template content preview:', templateContent.substring(0, 2000));
    
    // Look for member-related placeholders
    const memberMatches = templateContent.match(/\[\[[^\]]*member[^\]]*\]\]/gi);
    console.log('Member-related placeholders found:', memberMatches);
    
    // Look for all placeholders
    const allMatches = templateContent.match(/\[\[[^\]]*\]\]/gi);
    console.log('All placeholders found:', allMatches);
    
  } catch (error) {
    console.error('Template inspection failed:', error);
  }
}

// Test function to debug template issues
export async function testTemplateExport() {
  console.log('=== TESTING TEMPLATE EXPORT ===');
  
  // Try multiple different structures to see which one works
  const testData = {
    logo: '',
    barangay: 'Test Barangay',
    region: 'Test Region',
    province: 'Test Province',
    city: 'Test City',
    term_start: '2023',
    term_end: '2026',
    centers: [],
    // FLATTENED STRUCTURE - Test both approaches
    'prepared_by.secretary': 'TEST SECRETARY NAME',
    'prepared_by.chairperson': 'TEST CHAIRPERSON NAME',
    'prepared_by.treasurer': 'TEST TREASURER NAME',
    // Also keep the nested structure as backup
    prepared_by: {
      secretary: 'TEST SECRETARY NAME NESTED',
      chairperson: 'TEST CHAIRPERSON NAME NESTED',
      treasurer: 'TEST TREASURER NAME NESTED',
    },
    sk_federation_president: 'TEST FEDERATION PRESIDENT',
    
    // CORRECTED TEMPLATE STRUCTURE - Based on template screenshot
    // Template expects: [[#member_rows]] [[left.name]] [[position]] [[right.name]] [[position]] [[/member_rows]]
    member_rows: [
      { 
        'left.name': 'Left Member 1',
        'left.position': 'SK Kagawad',
        'right.name': 'Right Member 1', 
        'right.position': 'SK Kagawad'
      },
      { 
        'left.name': 'Left Member 2',
        'left.position': 'SK Kagawad',
        'right.name': 'Right Member 2',
        'right.position': 'SK Kagawad'
      },
      { 
        'left.name': 'Left Member 3',
        'left.position': 'SK Kagawad',
        'right.name': 'Right Member 3',
        'right.position': 'SK Kagawad'
      }
    ],
    
    // Alternative structure - try direct member names
    'member_rows.0.left.name': 'DIRECT KAGAWAD 1',
    'member_rows.0.right.name': 'DIRECT KAGAWAD 2',
    'member_rows.1.left.name': 'DIRECT KAGAWAD 3',
    'member_rows.1.right.name': 'DIRECT KAGAWAD 4',
    
    // Another alternative - try simple array
    members: [
      'SIMPLE MEMBER 1',
      'SIMPLE MEMBER 2',
      'SIMPLE MEMBER 3',
      'SIMPLE MEMBER 4',
      'SIMPLE MEMBER 5'
    ],
    
    // DIRECT INDIVIDUAL MEMBER FIELDS - Try this approach
    member1: 'DIRECT MEMBER 1',
    member2: 'DIRECT MEMBER 2',
    member3: 'DIRECT MEMBER 3',
    member4: 'DIRECT MEMBER 4',
    member5: 'DIRECT MEMBER 5',
    member6: 'DIRECT MEMBER 6',
    member7: 'DIRECT MEMBER 7',
    member8: 'DIRECT MEMBER 8',
    member9: 'DIRECT MEMBER 9',
    member10: 'DIRECT MEMBER 10'
  };
  
  console.log('Test data:', testData);
  
  try {
    await exportDocxFromTemplate({
      templatePath: '/templates/cbydp_template.docx',
      data: testData,
      outputFileName: 'TEST_CBYDP_DEBUG'
    });
    console.log('Test export completed successfully');
  } catch (error) {
    console.error('Test export failed:', error);
  }
}

export async function exportDocxFromTemplate(options: {
  templatePath: string;
  data: Record<string, any>;
  outputFileName: string;
}) {
  const { templatePath, data, outputFileName } = options;

  console.log('=== STARTING DOCX EXPORT ===');
  console.log('Template path:', templatePath);
  console.log('Output filename:', outputFileName);
  console.log('Full data object:', JSON.stringify(data, null, 2));
  
  // CRITICAL DEBUG: Log the exact data being sent
  console.log('=== CRITICAL DEBUG INFO ===');
  console.log('data.prepared_by:', data.prepared_by);
  console.log('data.prepared_by.secretary:', data.prepared_by?.secretary);
  console.log('data.prepared_by.chairperson:', data.prepared_by?.chairperson);
  console.log('data.prepared_by.treasurer:', data.prepared_by?.treasurer);
  console.log('data.sk_federation_president:', data.sk_federation_president);
  console.log('Type of secretary:', typeof data.prepared_by?.secretary);
  console.log('Type of chairperson:', typeof data.prepared_by?.chairperson);
  console.log('Type of federation president:', typeof data.sk_federation_president);

  const content = await fetchBinary(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Use square bracket delimiters to avoid Word splitting curly braces
    delimiters: { start: '[[', end: ']]' },
  });
  
  console.log('Setting data for docx template...');
  doc.setData(data);
  
  try {
    console.log('Rendering docx...');
    doc.render();
    console.log('Docx rendered successfully');
  } catch (error: any) {
    console.error('Docx render error:', error);
    console.error('Error details:', error.message);
    throw error;
  }
  
  console.log('Generating output file...');
  const out = doc.getZip().generate({ type: 'blob' });
  saveAs(out, outputFileName.endsWith('.docx') ? outputFileName : `${outputFileName}.docx`);
  console.log('Export completed successfully');
}

// Helper function to get member names with multiple fallback strategies
function getMemberNames(payload: any) {
  console.log('Getting member names from payload:', payload);
  
  // Strategy 1: Get from form.skMembers (current approach)
  const formMembers = payload?.form?.skMembers || [];
  console.log('Form members:', formMembers);
  
  // Strategy 2: Get from skProfile if available
  const profileMembers = payload?.skProfile?.skMembers || [];
  console.log('Profile members:', profileMembers);
  
  // Strategy 3: Get from user context if available
  const userContext = payload?.user || {};
  console.log('User context:', userContext);
  
  // Combine all sources and remove duplicates
  const allMembers = [...formMembers, ...profileMembers];
  const uniqueMembers = allMembers.filter((member, index, self) => 
    index === self.findIndex(m => m.name === member.name && m.position === member.position)
  );
  
  console.log('Combined unique members:', uniqueMembers);
  
  // If no members found, create default structure
  if (uniqueMembers.length === 0) {
    console.log('No members found, creating default structure');
    return {
      secretary: { name: 'Secretary Name', position: 'SK Secretary' },
      chairperson: { name: 'Chairperson Name', position: 'SK Chairperson' },
      treasurer: { name: 'Treasurer Name', position: 'SK Treasurer' },
      councilors: [],
      federationPresident: 'Federation President Name'
    };
  }
  
  // Find officers with multiple fallback strategies
  const secretary = uniqueMembers.find(m => 
    m.position === 'SK Secretary' || 
    m.position === 'secretary' ||
    m.role === 'secretary'
  );
  
  const chairperson = uniqueMembers.find(m => 
    m.position === 'SK Chairperson' || 
    m.position === 'chairperson' ||
    m.role === 'chairperson'
  );
  
  const treasurer = uniqueMembers.find(m => 
    m.position === 'SK Treasurer' || 
    m.position === 'treasurer' ||
    m.role === 'treasurer'
  );
  
  // Get councilors (all members except officers)
  const councilors = uniqueMembers.filter(m => 
    m.position !== 'SK Secretary' && 
    m.position !== 'SK Chairperson' && 
    m.position !== 'SK Treasurer' &&
    m.position !== 'secretary' &&
    m.position !== 'chairperson' &&
    m.position !== 'treasurer' &&
    m.role !== 'secretary' &&
    m.role !== 'chairperson' &&
    m.role !== 'treasurer' &&
    m.position !== 'SK Member' // Also filter out generic SK Member role
  );
  
  console.log('All unique members:', uniqueMembers);
  console.log('Councilors found:', councilors);
  console.log('Councilors count:', councilors.length);
  
  // If no councilors found, try to get all members with 'SK Member' position
  let kagawads = councilors;
  if (councilors.length === 0) {
    console.log('No councilors found, looking for SK Members...');
    kagawads = uniqueMembers.filter(m => 
      m.position === 'SK Member' || 
      (m.role && m.role !== 'chairperson' && m.role !== 'secretary' && m.role !== 'treasurer')
    );
    console.log('SK Members found:', kagawads);
  }
  
  // Get federation president from multiple sources
  const federationPresident = 
    payload?.skProfile?.federationPresident ||
    payload?.skProfile?.federation_president ||
    uniqueMembers.find(m => 
      m.position?.toLowerCase().includes('federation') ||
      m.role?.toLowerCase().includes('federation')
    )?.name ||
    'Federation President Name';
  
  // Ensure we always have valid names, even if they're placeholders
  const result = {
    secretary: secretary || { name: 'Secretary Name', position: 'SK Secretary' },
    chairperson: chairperson || { name: 'Chairperson Name', position: 'SK Chairperson' },
    treasurer: treasurer || { name: 'Treasurer Name', position: 'SK Treasurer' },
    councilors: kagawads, // Use kagawads instead of councilors
    federationPresident: federationPresident
  };
  
  // Additional validation - ensure names are not undefined
  if (!result.secretary.name || result.secretary.name === 'undefined') {
    result.secretary.name = 'Secretary Name';
  }
  if (!result.chairperson.name || result.chairperson.name === 'undefined') {
    result.chairperson.name = 'Chairperson Name';
  }
  if (!result.treasurer.name || result.treasurer.name === 'undefined') {
    result.treasurer.name = 'Treasurer Name';
  }
  if (!result.federationPresident || result.federationPresident === 'undefined') {
    result.federationPresident = 'Federation President Name';
  }
  
  console.log('Final member names result:', result);
  return result;
}

// Helpers to shape CBYDP/ABYIP data into template-friendly format
export function mapCBYDPToTemplate(payload: any) {
  console.log('Mapping CBYDP data:', payload);
  
  // Get member names using the new robust approach
  const memberNames = getMemberNames(payload);
  
  // Create member rows for councilors - FLATTENED STRUCTURE
  // Template expects: [[left.name]], [[left.position]], [[right.name]], [[right.position]]
  let memberRows = [] as Array<{ 'left.name': string; 'left.position': string; 'right.name'?: string; 'right.position'?: string }>;
  
  // Create pairs of members for left/right columns
  const kagawads = memberNames.councilors.filter((councilor: any) => councilor && councilor.name);
  
  for (let i = 0; i < kagawads.length; i += 2) {
    const leftMember = kagawads[i];
    const rightMember = kagawads[i + 1];
    
    memberRows.push({
      'left.name': leftMember.name,
      'left.position': leftMember.position || 'SK Kagawad',
      'right.name': rightMember ? rightMember.name : '',
      'right.position': rightMember ? (rightMember.position || 'SK Kagawad') : ''
    });
  }
  
  // FALLBACK: Only create test member rows if absolutely no real data is found
  if (memberRows.length === 0) {
    console.log('No real SK members found, creating minimal test data');
    memberRows = [
      { 
        'left.name': 'No SK Members Found',
        'left.position': 'Please add SK members in setup',
        'right.name': '',
        'right.position': ''
      }
    ];
  }
  
  console.log('Member rows:', memberRows);
  
  // DIRECT FIX: Ensure we always have valid names for the template
  // This is a fallback to prevent "undefined" from appearing
  let secretaryName = memberNames.secretary?.name || 'Secretary Name';
  let chairpersonName = memberNames.chairperson?.name || 'Chairperson Name';
  let treasurerName = memberNames.treasurer?.name || 'Treasurer Name';
  let federationPresidentName = memberNames.federationPresident || 'Federation President Name';
  
  // TEMPORARY DEBUG: Force specific names to test template
  // Remove this after confirming the template works
  if (secretaryName === 'Secretary Name' || !secretaryName || secretaryName === 'undefined') {
    secretaryName = 'John Doe';
  }
  if (chairpersonName === 'Chairperson Name' || !chairpersonName || chairpersonName === 'undefined') {
    chairpersonName = 'Jane Smith';
  }
  if (treasurerName === 'Treasurer Name' || !treasurerName || treasurerName === 'undefined') {
    treasurerName = 'Mike Johnson';
  }
  if (federationPresidentName === 'Federation President Name' || !federationPresidentName || federationPresidentName === 'undefined') {
    federationPresidentName = 'Sarah Wilson';
  }
  
  console.log('Direct name assignments:');
  console.log('- Secretary:', secretaryName);
  console.log('- Chairperson:', chairpersonName);
  console.log('- Treasurer:', treasurerName);
  console.log('- Federation President:', federationPresidentName);
  
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
      projects: (c.projects || []).map((p: any) => {
        // Combine programs, projects, and actions into ppas field
        const programs = (p.programs || []).filter((prog: string) => prog.trim());
        const projectItems = (p.projects || []).filter((proj: string) => proj.trim());
        const actions = (p.actions || []).filter((act: string) => act.trim());
        
        const ppasArray = [];
        if (programs.length > 0) ppasArray.push(`Programs: ${programs.join(', ')}`);
        if (projectItems.length > 0) ppasArray.push(`Projects: ${projectItems.join(', ')}`);
        if (actions.length > 0) ppasArray.push(`Actions: ${actions.join(', ')}`);
        
        const combinedPpas = ppasArray.join(' | ');
        
        return {
          concern: p.concern || '',
          objective: p.objective || '',
          indicator: p.indicator || '',
          target1: p.target1 || '',
          target2: p.target2 || '',
          target3: p.target3 || '',
          ppas: combinedPpas || p.ppas || '',
          expenses: (p.expenses || []).map((e: any) => ({ 
            description: e.description || '', 
            cost: e.cost || '' 
          })),
          responsible: p.responsible || '',
        };
      }),
    })),
    prepared_by: {
      secretary: secretaryName,
      chairperson: chairpersonName,
      treasurer: treasurerName,
    },
    sk_federation_president: federationPresidentName,
  };
  
  // FINAL VALIDATION: Ensure no undefined values make it to the template
  // Use flattened structure for better docxtemplater compatibility
  const finalResult = {
    ...result,
    // Flattened structure for template compatibility
    'prepared_by.secretary': String(result.prepared_by.secretary || 'John Doe'),
    'prepared_by.chairperson': String(result.prepared_by.chairperson || 'Jane Smith'),
    'prepared_by.treasurer': String(result.prepared_by.treasurer || 'Mike Johnson'),
    // Keep nested structure as backup
    prepared_by: {
      secretary: String(result.prepared_by.secretary || 'John Doe'),
      chairperson: String(result.prepared_by.chairperson || 'Jane Smith'),
      treasurer: String(result.prepared_by.treasurer || 'Mike Johnson'),
    },
    sk_federation_president: String(result.sk_federation_president || 'Sarah Wilson'),
    
    // FLATTENED MEMBER APPROACH - Individual member fields (updated for flattened structure)
    member1: memberRows[0]?.['left.name'] || 'Member 1',
    member2: memberRows[0]?.['right.name'] || 'Member 2',
    member3: memberRows[1]?.['left.name'] || 'Member 3',
    member4: memberRows[1]?.['right.name'] || 'Member 4',
    member5: memberRows[2]?.['left.name'] || 'Member 5',
    member6: memberRows[2]?.['right.name'] || 'Member 6',
    member7: memberRows[3]?.['left.name'] || 'Member 7',
    member8: memberRows[3]?.['right.name'] || 'Member 8',
    member9: memberRows[4]?.['left.name'] || 'Member 9',
    member10: memberRows[4]?.['right.name'] || 'Member 10',
  };
  
  console.log('Final mapped data:', finalResult);
  console.log('Final validation - prepared_by (nested):', finalResult.prepared_by);
  console.log('Final validation - prepared_by.secretary (flattened):', finalResult['prepared_by.secretary']);
  console.log('Final validation - prepared_by.chairperson (flattened):', finalResult['prepared_by.chairperson']);
  console.log('Final validation - prepared_by.treasurer (flattened):', finalResult['prepared_by.treasurer']);
  console.log('Final validation - sk_federation_president:', finalResult.sk_federation_president);
  console.log('Final validation - member_rows:', finalResult.member_rows);
  console.log('Final validation - member_rows length:', finalResult.member_rows?.length);
  if (finalResult.member_rows && finalResult.member_rows.length > 0) {
    console.log('First member row:', finalResult.member_rows[0]);
    console.log('First member left.name:', finalResult.member_rows[0]?.['left.name']);
    console.log('First member left.position:', finalResult.member_rows[0]?.['left.position']);
    console.log('First member right.name:', finalResult.member_rows[0]?.['right.name']);
    console.log('First member right.position:', finalResult.member_rows[0]?.['right.position']);
  }
  
  // Log individual member fields
  console.log('Individual member fields:');
  console.log('- member1:', finalResult.member1);
  console.log('- member2:', finalResult.member2);
  console.log('- member3:', finalResult.member3);
  console.log('- member4:', finalResult.member4);
  console.log('- member5:', finalResult.member5);
  
  return finalResult;
}

export function mapABYIPToTemplate(payload: any) {
  console.log('Mapping ABYIP data:', payload);
  
  // Get member names using the same robust approach as CBYDP
  const memberNames = getMemberNames(payload);
  
  // Create member rows for councilors - FLATTENED STRUCTURE (same as CBYDP)
  let memberRows = [] as Array<{ 'left.name': string; 'left.position': string; 'right.name'?: string; 'right.position'?: string }>;
  
  // Create pairs of members for left/right columns
  const kagawads = memberNames.councilors.filter((councilor: any) => councilor && councilor.name);
  
  for (let i = 0; i < kagawads.length; i += 2) {
    const leftMember = kagawads[i];
    const rightMember = kagawads[i + 1];
    
    memberRows.push({
      'left.name': leftMember.name,
      'left.position': leftMember.position || 'SK Kagawad',
      'right.name': rightMember ? rightMember.name : '',
      'right.position': rightMember ? (rightMember.position || 'SK Kagawad') : ''
    });
  }
  
  // FALLBACK: Only create test member rows if absolutely no real data is found
  if (memberRows.length === 0) {
    console.log('No real SK members found for ABYIP, creating minimal test data');
    memberRows = [
      { 
        'left.name': 'No SK Members Found',
        'left.position': 'Please add SK members in setup',
        'right.name': '',
        'right.position': ''
      }
    ];
  }
  
  console.log('ABYIP Member rows:', memberRows);
  
  // DIRECT FIX: Ensure we always have valid names for the template
  let secretaryName = memberNames.secretary?.name || 'Secretary Name';
  let chairpersonName = memberNames.chairperson?.name || 'Chairperson Name';
  let treasurerName = memberNames.treasurer?.name || 'Treasurer Name';
  let federationPresidentName = memberNames.federationPresident || 'Federation President Name';
  
  // TEMPORARY DEBUG: Force specific names to test template
  if (secretaryName === 'Secretary Name' || !secretaryName || secretaryName === 'undefined') {
    secretaryName = 'John Doe';
  }
  if (chairpersonName === 'Chairperson Name' || !chairpersonName || chairpersonName === 'undefined') {
    chairpersonName = 'Jane Smith';
  }
  if (treasurerName === 'Treasurer Name' || !treasurerName || treasurerName === 'undefined') {
    treasurerName = 'Mike Johnson';
  }
  if (federationPresidentName === 'Federation President Name' || !federationPresidentName || federationPresidentName === 'undefined') {
    federationPresidentName = 'Sarah Wilson';
  }
  
  const result = {
    logo: payload?.skProfile?.logo || '',
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
    member_rows: memberRows,
    sk_federation_president: federationPresidentName,
  };
  
  // FINAL VALIDATION: Ensure no undefined values make it to the template
  const finalResult = {
    ...result,
    // Flattened structure for template compatibility
    'prepared_by.secretary': String(secretaryName),
    'prepared_by.chairperson': String(chairpersonName),
    'prepared_by.treasurer': String(treasurerName),
    // Keep nested structure as backup
    prepared_by: {
      secretary: String(secretaryName),
      chairperson: String(chairpersonName),
      treasurer: String(treasurerName),
    },
    sk_federation_president: String(federationPresidentName),
  };
  
  console.log('Final ABYIP mapped data:', finalResult);
  return finalResult;
}


