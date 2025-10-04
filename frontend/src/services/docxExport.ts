import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

export type Binary = ArrayBuffer | Uint8Array;

// Number formatting utility for export
function formatNumberForExport(value: string | number): string {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  
  // Use actual member names from the data
  
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
            cost: formatNumberForExport(e.cost || '') 
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
    'prepared_by.secretary': String(result.prepared_by.secretary || ''),
    'prepared_by.chairperson': String(result.prepared_by.chairperson || ''),
    'prepared_by.treasurer': String(result.prepared_by.treasurer || ''),
    // Keep nested structure as backup
    prepared_by: {
      secretary: String(result.prepared_by.secretary || ''),
      chairperson: String(result.prepared_by.chairperson || ''),
      treasurer: String(result.prepared_by.treasurer || ''),
    },
    sk_federation_president: String(result.sk_federation_president || ''),
    
    // FLATTENED MEMBER APPROACH - Individual member fields (updated for flattened structure)
    member1: memberRows[0]?.['left.name'] || '',
    member2: memberRows[0]?.['right.name'] || '',
    member3: memberRows[1]?.['left.name'] || '',
    member4: memberRows[1]?.['right.name'] || '',
    member5: memberRows[2]?.['left.name'] || '',
    member6: memberRows[2]?.['right.name'] || '',
    member7: memberRows[3]?.['left.name'] || '',
    member8: memberRows[3]?.['right.name'] || '',
    member9: memberRows[4]?.['left.name'] || '',
    member10: memberRows[4]?.['right.name'] || '',
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
  
  // If no real SK members found, leave member rows empty
  if (memberRows.length === 0) {
    console.log('No real SK members found for ABYIP');
  }
  
  console.log('ABYIP Member rows:', memberRows);
  
  // Get real member names from the data
  let secretaryName = memberNames.secretary?.name || '';
  let chairpersonName = memberNames.chairperson?.name || '';
  let treasurerName = memberNames.treasurer?.name || '';
  let federationPresidentName = memberNames.federationPresident || '';
  
  // ABYIP Structure - Based on the template with centers loop like CBYDP
  const result = {
    logo: payload?.skProfile?.logo || '',
    barangay: payload?.skProfile?.barangay || '',
    region: payload?.skProfile?.region || '',
    province: payload?.skProfile?.province || '',
    city: payload?.skProfile?.city || '',
    year: payload?.form?.year || '',
    sk_federation_president: String(federationPresidentName),
    
    // CENTERS LOOP - Each center gets its own page like CBYDP
    centers: (payload?.form?.centers || []).map((c: any, index: number, array: any[]) => {
      const isLastCenter = index === array.length - 1;
      
      return {
      name: c.name || '',
      agenda: c.agenda || '',
      center_of_participation: c.name || '',
      
      // Projects for this center
      projects: (c.projects || []).map((p: any) => ({
        referenceCode: p.referenceCode || '',
        ppas: p.ppas || '',
        description: p.description || '',
        expectedResult: p.expectedResult || '',
        performanceIndicator: p.performanceIndicator || '',
        periodOfImplementation: p.periodOfImplementation || '',
        mooe: formatNumberForExport(p?.budget?.mooe || ''),
        co: formatNumberForExport(p?.budget?.co || ''),
        ps: formatNumberForExport(p?.budget?.ps || ''),
        total: formatNumberForExport(
          (parseFloat(p?.budget?.mooe?.replace(/,/g, '') || '0') +
           parseFloat(p?.budget?.co?.replace(/,/g, '') || '0') +
           parseFloat(p?.budget?.ps?.replace(/,/g, '') || '0')).toString()
        ),
        personResponsible: p.personResponsible || '',
      })),
      
      // Center subtotal calculations
      centerSubtotal: formatNumberForExport(
        (c.projects || []).reduce((sum: number, p: any) => {
          const mooe = parseFloat(p?.budget?.mooe?.replace(/,/g, '') || '0');
          const co = parseFloat(p?.budget?.co?.replace(/,/g, '') || '0');
          const ps = parseFloat(p?.budget?.ps?.replace(/,/g, '') || '0');
          return sum + mooe + co + ps;
        }, 0)
      ),
      centerSubtotalMOOE: formatNumberForExport(
        (c.projects || []).reduce((sum: number, p: any) => {
          return sum + parseFloat(p?.budget?.mooe?.replace(/,/g, '') || '0');
        }, 0)
      ),
      centerSubtotalCO: formatNumberForExport(
        (c.projects || []).reduce((sum: number, p: any) => {
          return sum + parseFloat(p?.budget?.co?.replace(/,/g, '') || '0');
        }, 0)
      ),
      centerSubtotalPS: formatNumberForExport(
        (c.projects || []).reduce((sum: number, p: any) => {
          return sum + parseFloat(p?.budget?.ps?.replace(/,/g, '') || '0');
        }, 0)
      ),
      
      // Member rows for this center
      member_rows: memberRows,
      
      // Flag to indicate if this is the last center (for conditional grand total row)
      isLastCenter: isLastCenter,
      
      // Grand totals - only for the last center
      ...(isLastCenter && {
        grandTotal: formatNumberForExport(
          (payload?.form?.centers || []).reduce((totalSum: number, center: any) => {
            return totalSum + (center.projects || []).reduce((centerSum: number, p: any) => {
              const mooe = parseFloat(p?.budget?.mooe?.replace(/,/g, '') || '0');
              const co = parseFloat(p?.budget?.co?.replace(/,/g, '') || '0');
              const ps = parseFloat(p?.budget?.ps?.replace(/,/g, '') || '0');
              return centerSum + mooe + co + ps;
            }, 0);
          }, 0)
        ),
        grandTotalMOOE: formatNumberForExport(
          (payload?.form?.centers || []).reduce((totalSum: number, center: any) => {
            return totalSum + (center.projects || []).reduce((centerSum: number, p: any) => {
              return centerSum + parseFloat(p?.budget?.mooe?.replace(/,/g, '') || '0');
            }, 0);
          }, 0)
        ),
        grandTotalCO: formatNumberForExport(
          (payload?.form?.centers || []).reduce((totalSum: number, center: any) => {
            return totalSum + (center.projects || []).reduce((centerSum: number, p: any) => {
              return centerSum + parseFloat(p?.budget?.co?.replace(/,/g, '') || '0');
            }, 0);
          }, 0)
        ),
        grandTotalPS: formatNumberForExport(
          (payload?.form?.centers || []).reduce((totalSum: number, center: any) => {
            return totalSum + (center.projects || []).reduce((centerSum: number, p: any) => {
              return centerSum + parseFloat(p?.budget?.ps?.replace(/,/g, '') || '0');
            }, 0);
          }, 0)
        ),
      }),
    };
    }),
    
    // Global member rows (for second page)
    member_rows: memberRows,
    
    // Grand totals are now only included in the last center
    
    // Prepared by section - ABYIP typically has Treasurer and Chairperson
    prepared_by: {
      secretary: String(secretaryName),
      chairperson: String(chairpersonName),
      treasurer: String(treasurerName),
    },
  };
  
  
  // FINAL VALIDATION: Ensure no undefined values make it to the template
  const finalResult = {
    ...result,
    // Flattened structure for template compatibility
    'prepared_by.secretary': String(secretaryName),
    'prepared_by.chairperson': String(chairpersonName),
    'prepared_by.treasurer': String(treasurerName),
    sk_federation_president: String(federationPresidentName),
  };
  
  console.log('Final ABYIP mapped data:', finalResult);
  return finalResult;
}

export function mapBudgetToTemplate(payload: any) {
  console.log('Mapping Budget data:', payload);
  
  const budget = payload.form;
  const profile = payload.skProfile;

  // Get member names using the same approach as ABYIP
  const memberNames = getMemberNames(payload);
  
  // Get real member names from the data
  let secretaryName = memberNames.secretary?.name || '';
  let chairpersonName = memberNames.chairperson?.name || '';
  let treasurerName = memberNames.treasurer?.name || '';

  // Fallback: Use skMembers from Budget data if getMemberNames doesn't work
  if (!treasurerName || !chairpersonName) {
    const skMembers = budget?.skMembers || payload.skMembers || [];
    console.log('DEBUG - Using skMembers from Budget data:', skMembers);
    
    const treasurer = skMembers.find((m: any) => m.role === 'treasurer');
    const chairperson = skMembers.find((m: any) => m.role === 'chairperson');
    
    if (treasurer && !treasurerName) {
      treasurerName = treasurer.name || '';
      console.log('DEBUG - Found treasurer from Budget skMembers:', treasurerName);
    }
    
    if (chairperson && !chairpersonName) {
      chairpersonName = chairperson.name || '';
      console.log('DEBUG - Found chairperson from Budget skMembers:', chairpersonName);
    }
  }

  const fmt = (n: number) => (typeof n === 'number' ? n.toLocaleString() : '');
  const dateStr = budget?.sk_resolution_date
    ? new Date(budget.sk_resolution_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const generalAdministration = (budget?.programs || []).find((p: any) => p.program_type === 'general_administration') || { items: [], mooe_total: 0, co_total: 0 };
  const youthDevelopment = (budget?.programs || []).find((p: any) => p.program_type === 'youth_development') || { items: [], mooe_total: 0, co_total: 0 };

  const result = {
    // Header
    province: profile?.province || '',
    city: profile?.city || '',
    barangay: profile?.barangay || '',
    logo: profile?.logo || '',
    year: budget?.year || '',

    // Resolution / ordinance
    sk_resolution_no: budget?.sk_resolution_no || '',
    sk_resolution_series: budget?.sk_resolution_series || budget?.year || '',
    sk_resolution_date: dateStr,
    ordinance_no: budget?.barangay_appropriation_ordinance_no || '',
    ordinance_series: budget?.ordinance_series || budget?.year || '',

    // Amounts
    total_budget: fmt(budget?.total_budget || 0),


    // Receipts (Part I)
    receipts: (budget?.receipts || []).map((r: any) => ({
      source_description: String(r.source_description || ''),
      duration: String(r.duration || ''),
      mooe_amount: String(fmt(r.mooe_amount || 0)),
      co_amount: String(fmt(r.co_amount || 0)),
      ps_amount: String(fmt(r.ps_amount || 0)),
      total_amount: String(fmt(r.total_amount || 0)),
    })),
    receipts_totals: {
      mooe: fmt((budget?.receipts || []).reduce((s: number, r: any) => s + (r.mooe_amount || 0), 0)),
      co: fmt((budget?.receipts || []).reduce((s: number, r: any) => s + (r.co_amount || 0), 0)),
      ps: fmt((budget?.receipts || []).reduce((s: number, r: any) => s + (r.ps_amount || 0), 0)),
      total: fmt((budget?.receipts || []).reduce((s: number, r: any) => s + (r.total_amount || 0), 0)),
      amount: fmt((budget?.receipts || []).reduce((s: number, r: any) => s + (r.total_amount || 0), 0)), // Total for AMOUNT column
    },

    // Part II.A General Administration - Grouped by expenditure class
    ga_mooe_items: [{
      description: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'MOOE')
        .map((i: any) => `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`)
        .join('\n\n'),
      duration: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'MOOE')
        .map((i: any) => i.duration || '')
        .join('\n\n'),
      mooe: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'MOOE')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
      co: '',
      ps: '',
      amount: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'MOOE')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
    }],
    ga_co_items: [{
      description: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'CO')
        .map((i: any) => `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`)
        .join('\n\n'),
      duration: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'CO')
        .map((i: any) => i.duration || '')
        .join('\n\n'),
      mooe: '',
      co: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'CO')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
      ps: '',
      amount: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'CO')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
    }],
    ga_ps_items: [{
      description: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'PS')
        .map((i: any) => `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`)
        .join('\n\n'),
      duration: generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'PS')
        .map((i: any) => i.duration || '')
        .join('\n\n'),
      mooe: '',
      co: '',
      ps: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'PS')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
      amount: fmt(generalAdministration.items
        .filter((i: any) => i.expenditure_class === 'PS')
        .reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
    }],
    ga_totals: {
      mooe: fmt(generalAdministration.mooe_total || 0),
      co: fmt(generalAdministration.co_total || 0),
      ps: fmt(generalAdministration.ps_total || 0),
      amount: fmt(generalAdministration.total_amount || 0), // Total for AMOUNT column
    },

    // Part II.B Youth Development - Grouped by center and expenditure class
    yd_items: (() => {
      const result: any[] = [];

      // Process each center
      (youthDevelopment.centers || []).forEach((center: any) => {
        const centerName = center.center_name || '';
        const items = center.items || [];

        // Group items by expenditure class within this center
        const mooeItems = items.filter((i: any) => i.expenditure_class === 'MOOE');
        const coItems = items.filter((i: any) => i.expenditure_class === 'CO');
        const psItems = items.filter((i: any) => i.expenditure_class === 'PS');

        // Add MOOE row for this center if there are MOOE items
        if (mooeItems.length > 0) {
          const mooeDisplay = mooeItems.map((i: any) => 
            `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`
          ).join('\n');
          
          result.push({
            center_name: centerName,
            name: mooeDisplay,
            description: '', // Empty since description is already in the name field
            duration: mooeItems.map((i: any) => i.duration || '').join('\n'),
            mooe: fmt(mooeItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
            co: '',
            ps: '',
            amount: fmt(mooeItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
          });
        }

        // Add CO row for this center if there are CO items
        if (coItems.length > 0) {
          const coDisplay = coItems.map((i: any) => 
            `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`
          ).join('\n');
          
          result.push({
            center_name: centerName,
            name: coDisplay,
            description: '', // Empty since description is already in the name field
            duration: coItems.map((i: any) => i.duration || '').join('\n'),
            mooe: '',
            co: fmt(coItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
            ps: '',
            amount: fmt(coItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
          });
        }

        // Add PS row for this center if there are PS items
        if (psItems.length > 0) {
          const psDisplay = psItems.map((i: any) => 
            `${i.item_description || ''}\n${i.item_name || ''} - P ${fmt(i.amount || 0)}`
          ).join('\n');
          
          result.push({
            center_name: centerName,
            name: psDisplay,
            description: '', // Empty since description is already in the name field
            duration: psItems.map((i: any) => i.duration || '').join('\n'),
            mooe: '',
            co: '',
            ps: fmt(psItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0)),
            amount: fmt(psItems.reduce((sum: number, i: any) => sum + (i.amount || 0), 0))
          });
        }
      });

      return result;
    })(),
    yd_totals: {
      mooe: fmt(youthDevelopment.mooe_total || 0),
      co: fmt(youthDevelopment.co_total || 0),
      ps: fmt(youthDevelopment.ps_total || 0),
      amount: fmt(youthDevelopment.total_amount || 0), // Total for AMOUNT column
    },

    // Grand totals
    exp_totals: {
      mooe: fmt((budget?.programs || []).reduce((s: number, p: any) => s + (p.mooe_total || 0), 0)),
      co: fmt((budget?.programs || []).reduce((s: number, p: any) => s + (p.co_total || 0), 0)),
      ps: fmt((budget?.programs || []).reduce((s: number, p: any) => s + (p.ps_total || 0), 0)),
      amount: fmt((budget?.programs || []).reduce((s: number, p: any) => s + (p.total_amount || 0), 0)), // Total for AMOUNT column
    },
  };

  // FINAL VALIDATION: Ensure no undefined values make it to the template
  // Use flattened structure for better docxtemplater compatibility (like ABYIP)
  const finalResult = {
    ...result,
    // Flattened structure for template compatibility with [[]] delimiters
    'province': String(result.province || ''),
    'city': String(result.city || ''),
    'barangay': String(result.barangay || ''),
    'logo': String(result.logo || ''),
    'year': String(result.year || ''),
    'sk_resolution_no': String(result.sk_resolution_no || ''),
    'sk_resolution_series': String(result.sk_resolution_series || ''),
    'sk_resolution_date': String(result.sk_resolution_date || ''),
    'ordinance_no': String(result.ordinance_no || ''),
    'ordinance_series': String(result.ordinance_series || ''),
    'total_budget': String(result.total_budget || ''),
    // Flattened prepared_by structure (like ABYIP)
    'prepared_by.treasurer': String(treasurerName),
    'prepared_by.chairperson': String(chairpersonName),
    // Flattened totals structure to prevent undefined values
    'receipts_totals.mooe': String(result.receipts_totals?.mooe || '0'),
    'receipts_totals.co': String(result.receipts_totals?.co || '0'),
    'receipts_totals.ps': String(result.receipts_totals?.ps || '0'),
    'receipts_totals.total': String(result.receipts_totals?.total || '0'),
    'receipts_totals.amount': String(result.receipts_totals?.amount || '0'),
    'ga_totals.mooe': String(result.ga_totals?.mooe || '0'),
    'ga_totals.co': String(result.ga_totals?.co || '0'),
    'ga_totals.ps': String(result.ga_totals?.ps || '0'),
    'ga_totals.amount': String(result.ga_totals?.amount || '0'),
    'yd_totals.mooe': String(result.yd_totals?.mooe || '0'),
    'yd_totals.co': String(result.yd_totals?.co || '0'),
    'yd_totals.ps': String(result.yd_totals?.ps || '0'),
    'yd_totals.amount': String(result.yd_totals?.amount || '0'),
    'exp_totals.mooe': String(result.exp_totals?.mooe || '0'),
    'exp_totals.co': String(result.exp_totals?.co || '0'),
    'exp_totals.ps': String(result.exp_totals?.ps || '0'),
    'exp_totals.amount': String(result.exp_totals?.amount || '0'),
  };

  console.log('Final Budget mapped data:', finalResult);
  console.log('DEBUG - receipts array:', finalResult.receipts);
  console.log('DEBUG - receipts array length:', finalResult.receipts?.length);
  console.log('DEBUG - ga_mooe_items array:', finalResult.ga_mooe_items);
  console.log('DEBUG - ga_mooe_items array length:', finalResult.ga_mooe_items?.length);
  console.log('DEBUG - ga_co_items array:', finalResult.ga_co_items);
  console.log('DEBUG - ga_co_items array length:', finalResult.ga_co_items?.length);
  console.log('DEBUG - ga_ps_items array:', finalResult.ga_ps_items);
  console.log('DEBUG - ga_ps_items array length:', finalResult.ga_ps_items?.length);
  console.log('DEBUG - yd_items array:', finalResult.yd_items);
  console.log('DEBUG - yd_items array length:', finalResult.yd_items?.length);
  console.log('DEBUG - member names:', { treasurerName, chairpersonName, secretaryName });
  console.log('DEBUG - prepared_by.treasurer in finalResult:', finalResult['prepared_by.treasurer']);
  console.log('DEBUG - prepared_by.chairperson in finalResult:', finalResult['prepared_by.chairperson']);
  return finalResult;
}

export function mapRCBToTemplate(payload: any) {
  console.log('Mapping RCB data:', payload);
  console.log('RCB Form data:', payload.form);
  console.log('SK Profile:', payload.skProfile);
  console.log('SK Members:', payload.skMembers);
  
  // Follow the same pattern as Budget component
  const rcbForm = payload.form;
  const skProfile = payload.skProfile;
  const skMembers = payload.skMembers || [];
  
  // Validate required data
  if (!rcbForm) {
    console.error('RCB form data is missing!');
    return {};
  }
  
  if (!rcbForm.settings) {
    console.error('RCB settings are missing!');
  }
  
  if (!rcbForm.metadata) {
    console.error('RCB metadata are missing!');
  }
  
  if (!rcbForm.entries) {
    console.error('RCB entries are missing!');
  }
  
  // Get member names
  const treasurer = skMembers.find((m: any) => m.role === 'treasurer');
  const chairperson = skMembers.find((m: any) => m.role === 'chairperson');
  
  const treasurerName = treasurer?.name || 'SK Treasurer';
  const chairpersonName = chairperson?.name || 'SK Chairperson';
  
  const quarterMonths = {
    'Q1': 'January - March',
    'Q2': 'April - June', 
    'Q3': 'July - September',
    'Q4': 'October - December'
  };
  
  const quarterDisplay = {
    'Q1': '1st',
    'Q2': '2nd', 
    'Q3': '3rd',
    'Q4': '4th'
  };
  
  // Get the actual quarter and year from the data
  const actualQuarter = rcbForm.quarter || 'Q1';
  const actualYear = rcbForm.financialYear || new Date().getFullYear();
  
  // Helper function to format numbers - return blank if zero
  const fmt = (n: number) => {
    if (typeof n !== 'number' || n === 0) return '';
    return n.toLocaleString();
  };
  
  // Build dynamic table headers based on settings
  const mooeHeaders = rcbForm.settings?.mooeAccounts || ['Travelling Expenses', 'Maintenance/Other Operating'];
  const coHeaders = rcbForm.settings?.coAccounts || ['Office Equipment'];
  const withholdingHeaders = rcbForm.settings?.withholdingTypes || ['Type 1', 'Type 2'];
  
  console.log('RCB Form Settings:', rcbForm.settings);
  console.log('MOOE Accounts:', mooeHeaders);
  console.log('CO Accounts:', coHeaders);
  console.log('Withholding Types:', withholdingHeaders);
  console.log('RCB Form Entries:', rcbForm.entries);
  console.log('RCB Form Metadata:', rcbForm.metadata);
  
  console.log('RCB Headers:', { mooeHeaders, coHeaders, withholdingHeaders });
  console.log('Number of MOOE columns:', mooeHeaders.length);
  console.log('Number of CO columns:', coHeaders.length);
  console.log('Number of Withholding columns:', withholdingHeaders.length);
  
  // Calculate totals
  console.log('=== CALCULATING TOTALS ===');
  const totals = rcbForm.entries?.reduce((acc: any, entry: any) => {
    console.log('Processing entry for totals:', entry);
    acc.deposit += entry.deposit || 0;
    acc.withdrawal += entry.withdrawal || 0;
    acc.balance = entry.balance || 0; // Last entry's balance
    acc.advOfficials += entry.advOfficials || 0;
    acc.advTreasurer += entry.advTreasurer || 0;
    acc.others += entry.others || 0;
    
    // MOOE totals
    mooeHeaders.forEach((header: string) => {
      if (!acc.mooe) acc.mooe = {};
      acc.mooe[header] = (acc.mooe[header] || 0) + (entry.mooe?.[header] || 0);
    });
    
    // CO totals
    coHeaders.forEach((header: string) => {
      if (!acc.co) acc.co = {};
      acc.co[header] = (acc.co[header] || 0) + (entry.co?.[header] || 0);
    });
    
    // Withholding totals
    withholdingHeaders.forEach((header: string) => {
      if (!acc.withholding) acc.withholding = {};
      acc.withholding[header] = (acc.withholding[header] || 0) + (entry.withholding?.[header] || 0);
    });
    
    console.log('Accumulated totals so far:', acc);
    return acc;
  }, {
    deposit: 0,
    withdrawal: 0,
    balance: 0,
    advOfficials: 0,
    advTreasurer: 0,
    others: 0,
    mooe: {},
    co: {},
    withholding: {}
  }) || {
    deposit: 0,
    withdrawal: 0,
    balance: 0,
    advOfficials: 0,
    advTreasurer: 0,
    others: 0,
    mooe: {},
    co: {},
    withholding: {}
  };
  
  console.log('Final calculated totals:', totals);
  
  const result = {
    // Header information
    logo: skProfile?.logo || '',
    barangay: skProfile?.barangay || '',
    city: skProfile?.city || '',
    province: skProfile?.province || '',
    quarter: quarterDisplay[actualQuarter as keyof typeof quarterDisplay],
    quarter_months: quarterMonths[actualQuarter as keyof typeof quarterMonths] || '',
    quarter_code: actualQuarter,
    calendar_year: actualYear,
    fund: rcbForm.metadata?.fund || '',
    sheet_no: rcbForm.metadata?.sheetNo || '',
    
    // Dynamic column structure for automatic column creation
    dynamic_columns: {
      // MOOE columns
      mooe: mooeHeaders.map((header: string, index: number) => ({
        header: String(header || ''),
        index: index,
        type: 'mooe'
      })),
      // CO columns
      co: coHeaders.map((header: string, index: number) => ({
        header: String(header || ''),
        index: index,
        type: 'co'
      })),
      // Withholding columns
      withholding: withholdingHeaders.map((header: string, index: number) => ({
        header: String(header || ''),
        index: index,
        type: 'withholding'
      }))
    },
    
    // Header structure that matches the 3-row template exactly
    // Row 1: Main headers (Date, Reference, Name of Payee, Particulars, Cash in Bank, BREAKDOWN, Withholding Tax)
    // Row 2: Sub-groups (Deposit, Withdrawal, Balance, MOOE, Capital Outlay, Advances, Others, Withholding Tax)
    // Row 3: Individual sub-columns (actual account names)
    
    // MOOE sub-columns (Row 3 under "Maintenance and Other Operating Expenses")
    mooe_sub_columns: mooeHeaders.map((header: string, index: number) => ({
      header: String(header || ''),
      index: index,
      type: 'mooe'
    })),
    
    // CO sub-columns (Row 3 under "Capital Outlay") 
    co_sub_columns: coHeaders.map((header: string, index: number) => ({
      header: String(header || ''),
      index: index,
      type: 'co'
    })),
    
    // Withholding sub-columns (Row 3 under "Withholding Tax")
    withholding_sub_columns: withholdingHeaders.map((header: string, index: number) => ({
      header: String(header || ''),
      index: index,
      type: 'withholding'
    })),
    
    // Column counts for colspan calculations
    mooe_colspan: mooeHeaders.length,
    co_colspan: coHeaders.length,
    withholding_colspan: withholdingHeaders.length,
    
    // Individual column headers for separate table columns (max 3 each)
    mooe_col_1: mooeHeaders[0] || '',
    mooe_col_2: mooeHeaders[1] || '',
    mooe_col_3: mooeHeaders[2] || '',
    
    co_col_1: coHeaders[0] || '',
    co_col_2: coHeaders[1] || '',
    co_col_3: coHeaders[2] || '',
    
    withholding_col_1: withholdingHeaders[0] || '',
    withholding_col_2: withholdingHeaders[1] || '',
    withholding_col_3: withholdingHeaders[2] || '',
    
    // Conditional flags to show/hide columns (max 3 each) - converted to strings for template
    has_mooe_col_1: String(mooeHeaders.length >= 1),
    has_mooe_col_2: String(mooeHeaders.length >= 2),
    has_mooe_col_3: String(mooeHeaders.length >= 3),
    
    has_co_col_1: String(coHeaders.length >= 1),
    has_co_col_2: String(coHeaders.length >= 2),
    has_co_col_3: String(coHeaders.length >= 3),
    
    has_withholding_col_1: String(withholdingHeaders.length >= 1),
    has_withholding_col_2: String(withholdingHeaders.length >= 2),
    has_withholding_col_3: String(withholdingHeaders.length >= 3),
    
    // Column counts for template logic
    column_counts: {
      mooe: mooeHeaders.length,
      co: coHeaders.length,
      withholding: withholdingHeaders.length,
      total: mooeHeaders.length + coHeaders.length + withholdingHeaders.length
    },
    
    // Balance brought forward
    balance_brought_forward: fmt(rcbForm.metadata?.balanceBroughtForward || 0),
    
    // Totals/Balance brought forwarded (same structure as carried forward)
    totals_brought_forward: {
      deposit: '0.00',
      withdrawal: '0.00', 
      balance: fmt(rcbForm.metadata?.balanceBroughtForward || 0),
      adv_officials: '0.00',
      adv_treasurer: '0.00',
      others: '0.00',
      // Dynamic totals - all zeros for brought forward
      mooe_totals: mooeHeaders.map(() => '0.00'),
      co_totals: coHeaders.map(() => '0.00'),
      withholding_totals: withholdingHeaders.map(() => '0.00'),
      
      // Individual column totals for separate table columns (max 3 each) - all zeros for brought forward
      mooe_total_1: '0.00',
      mooe_total_2: '0.00',
      mooe_total_3: '0.00',
      
      co_total_1: '0.00',
      co_total_2: '0.00',
      co_total_3: '0.00',
      
      withholding_total_1: '0.00',
      withholding_total_2: '0.00',
      withholding_total_3: '0.00',
    },
    
    // Entries with dynamic column structure
    entries: (rcbForm.entries || []).map((entry: any, index: number) => {
      console.log(`Processing entry ${index}:`, entry);
      
      // Create dynamic column values
      const mooeValues = mooeHeaders.map((header: string) => {
        const value = entry.mooe?.[header] || 0;
        console.log(`MOOE ${header}:`, value);
        return String(fmt(value));
      });
      
      const coValues = coHeaders.map((header: string) => {
        const value = entry.co?.[header] || 0;
        console.log(`CO ${header}:`, value);
        return String(fmt(value));
      });
      
      const withholdingValues = withholdingHeaders.map((header: string) => {
        const value = entry.withholding?.[header] || 0;
        console.log(`Withholding ${header}:`, value);
        return String(fmt(value));
      });
      
      return {
        date: String(entry.date || ''),
        reference: String(entry.reference || ''),
        payee: String(entry.payee || ''),
        particulars: String(entry.particulars || ''),
        deposit: fmt(entry.deposit || 0),
        withdrawal: fmt(entry.withdrawal || 0),
        balance: fmt(entry.balance || 0),
        adv_officials: fmt(entry.advOfficials || 0),
        adv_treasurer: fmt(entry.advTreasurer || 0),
        others: fmt(entry.others || 0),
        
        // Simple value arrays - just like entries
        mooe_values: mooeValues.map((value: string) => ({ value: value })),
        co_values: coValues.map((value: string) => ({ value: value })),
        withholding_values: withholdingValues.map((value: string) => ({ value: value })),
        
        // Individual column values for separate table columns (max 3 each) - blank if zero
        mooe_val_1: mooeValues[0] || '',
        mooe_val_2: mooeValues[1] || '',
        mooe_val_3: mooeValues[2] || '',
        
        co_val_1: coValues[0] || '',
        co_val_2: coValues[1] || '',
        co_val_3: coValues[2] || '',
        
        withholding_val_1: withholdingValues[0] || '',
        withholding_val_2: withholdingValues[1] || '',
        withholding_val_3: withholdingValues[2] || '',
        
      };
    }),
    
    // Totals for the quarter with dynamic structure
    totals_quarter: {
      deposit: fmt(totals.deposit),
      withdrawal: fmt(totals.withdrawal),
      balance: fmt(totals.balance),
      adv_officials: fmt(totals.advOfficials),
      adv_treasurer: fmt(totals.advTreasurer),
      others: fmt(totals.others),
      
      // Simple totals arrays - just like entries
      mooe_totals: mooeHeaders.map((header: string) => ({ value: String(fmt(totals.mooe?.[header] || 0)) })),
      co_totals: coHeaders.map((header: string) => ({ value: String(fmt(totals.co?.[header] || 0)) })),
      withholding_totals: withholdingHeaders.map((header: string) => ({ value: String(fmt(totals.withholding?.[header] || 0)) })),
      
      // Individual column totals for separate table columns (max 3 each) - blank if zero
      mooe_total_1: fmt(totals.mooe?.[mooeHeaders[0]] || 0),
      mooe_total_2: fmt(totals.mooe?.[mooeHeaders[1]] || 0),
      mooe_total_3: fmt(totals.mooe?.[mooeHeaders[2]] || 0),
      
      co_total_1: fmt(totals.co?.[coHeaders[0]] || 0),
      co_total_2: fmt(totals.co?.[coHeaders[1]] || 0),
      co_total_3: fmt(totals.co?.[coHeaders[2]] || 0),
      
      withholding_total_1: fmt(totals.withholding?.[withholdingHeaders[0]] || 0),
      withholding_total_2: fmt(totals.withholding?.[withholdingHeaders[1]] || 0),
      withholding_total_3: fmt(totals.withholding?.[withholdingHeaders[2]] || 0),
    },
    
    // Totals/Balance carried forward (same values as quarter totals)
    totals_carried_forward: {
      deposit: fmt(totals.deposit),
      withdrawal: fmt(totals.withdrawal),
      balance: fmt(totals.balance),
      adv_officials: fmt(totals.advOfficials),
      adv_treasurer: fmt(totals.advTreasurer),
      others: fmt(totals.others),
      
      // Simple totals arrays - just like entries
      mooe_totals: mooeHeaders.map((header: string) => ({ value: String(fmt(totals.mooe?.[header] || 0)) })),
      co_totals: coHeaders.map((header: string) => ({ value: String(fmt(totals.co?.[header] || 0)) })),
      withholding_totals: withholdingHeaders.map((header: string) => ({ value: String(fmt(totals.withholding?.[header] || 0)) })),
      
      // Individual column totals for separate table columns (max 3 each) - blank if zero
      mooe_total_1: fmt(totals.mooe?.[mooeHeaders[0]] || 0),
      mooe_total_2: fmt(totals.mooe?.[mooeHeaders[1]] || 0),
      mooe_total_3: fmt(totals.mooe?.[mooeHeaders[2]] || 0),
      
      co_total_1: fmt(totals.co?.[coHeaders[0]] || 0),
      co_total_2: fmt(totals.co?.[coHeaders[1]] || 0),
      co_total_3: fmt(totals.co?.[coHeaders[2]] || 0),
      
      withholding_total_1: fmt(totals.withholding?.[withholdingHeaders[0]] || 0),
      withholding_total_2: fmt(totals.withholding?.[withholdingHeaders[1]] || 0),
      withholding_total_3: fmt(totals.withholding?.[withholdingHeaders[2]] || 0),
    },
    
    // Signatures
    treasurer_name: treasurerName,
    chairperson_name: chairpersonName,
  };
  
  // FINAL VALIDATION: Ensure no undefined values make it to the template
  // Use flattened structure for better docxtemplater compatibility (like Budget)
  const finalResult = {
    ...result,
    // Flattened structure for template compatibility with [[]] delimiters
    'logo': String(result.logo || ''),
    'barangay': String(result.barangay || ''),
    'city': String(result.city || ''),
    'province': String(result.province || ''),
    'quarter': String(result.quarter || ''),
    'quarter_months': String(result.quarter_months || ''),
    'quarter_code': String(result.quarter_code || ''),
    'calendar_year': String(result.calendar_year || ''),
    'fund': String(result.fund || ''),
    'sheet_no': String(result.sheet_no || ''),
    'balance_brought_forward': String(result.balance_brought_forward || '0'),
    'treasurer_name': String(result.treasurer_name || ''),
    'chairperson_name': String(result.chairperson_name || ''),
    // Flattened totals structure to prevent undefined values - blank if zero
    'totals_quarter.deposit': String(result.totals_quarter?.deposit || ''),
    'totals_quarter.withdrawal': String(result.totals_quarter?.withdrawal || ''),
    'totals_quarter.balance': String(result.totals_quarter?.balance || ''),
    'totals_quarter.adv_officials': String(result.totals_quarter?.adv_officials || ''),
    'totals_quarter.adv_treasurer': String(result.totals_quarter?.adv_treasurer || ''),
    'totals_quarter.others': String(result.totals_quarter?.others || ''),
    'totals_carried_forward.deposit': String(result.totals_carried_forward?.deposit || ''),
    'totals_carried_forward.withdrawal': String(result.totals_carried_forward?.withdrawal || ''),
    'totals_carried_forward.balance': String(result.totals_carried_forward?.balance || ''),
    'totals_carried_forward.adv_officials': String(result.totals_carried_forward?.adv_officials || ''),
    'totals_carried_forward.adv_treasurer': String(result.totals_carried_forward?.adv_treasurer || ''),
    'totals_carried_forward.others': String(result.totals_carried_forward?.others || ''),
    'totals_brought_forward.deposit': String(result.totals_brought_forward?.deposit || '0.00'),
    'totals_brought_forward.withdrawal': String(result.totals_brought_forward?.withdrawal || '0.00'),
    'totals_brought_forward.balance': String(result.totals_brought_forward?.balance || '0.00'),
    'totals_brought_forward.adv_officials': String(result.totals_brought_forward?.adv_officials || '0.00'),
    'totals_brought_forward.adv_treasurer': String(result.totals_brought_forward?.adv_treasurer || '0.00'),
    'totals_brought_forward.others': String(result.totals_brought_forward?.others || '0.00'),
    
    // Flattened individual column totals to prevent undefined values - blank if zero
    'totals_quarter.mooe_total_1': String(result.totals_quarter?.mooe_total_1 || ''),
    'totals_quarter.mooe_total_2': String(result.totals_quarter?.mooe_total_2 || ''),
    'totals_quarter.mooe_total_3': String(result.totals_quarter?.mooe_total_3 || ''),
    'totals_quarter.co_total_1': String(result.totals_quarter?.co_total_1 || ''),
    'totals_quarter.co_total_2': String(result.totals_quarter?.co_total_2 || ''),
    'totals_quarter.co_total_3': String(result.totals_quarter?.co_total_3 || ''),
    'totals_quarter.withholding_total_1': String(result.totals_quarter?.withholding_total_1 || ''),
    'totals_quarter.withholding_total_2': String(result.totals_quarter?.withholding_total_2 || ''),
    'totals_quarter.withholding_total_3': String(result.totals_quarter?.withholding_total_3 || ''),
    
    'totals_carried_forward.mooe_total_1': String(result.totals_carried_forward?.mooe_total_1 || ''),
    'totals_carried_forward.mooe_total_2': String(result.totals_carried_forward?.mooe_total_2 || ''),
    'totals_carried_forward.mooe_total_3': String(result.totals_carried_forward?.mooe_total_3 || ''),
    'totals_carried_forward.co_total_1': String(result.totals_carried_forward?.co_total_1 || ''),
    'totals_carried_forward.co_total_2': String(result.totals_carried_forward?.co_total_2 || ''),
    'totals_carried_forward.co_total_3': String(result.totals_carried_forward?.co_total_3 || ''),
    'totals_carried_forward.withholding_total_1': String(result.totals_carried_forward?.withholding_total_1 || ''),
    'totals_carried_forward.withholding_total_2': String(result.totals_carried_forward?.withholding_total_2 || ''),
    'totals_carried_forward.withholding_total_3': String(result.totals_carried_forward?.withholding_total_3 || ''),
    
    'totals_brought_forward.mooe_total_1': String(result.totals_brought_forward?.mooe_total_1 || '0.00'),
    'totals_brought_forward.mooe_total_2': String(result.totals_brought_forward?.mooe_total_2 || '0.00'),
    'totals_brought_forward.mooe_total_3': String(result.totals_brought_forward?.mooe_total_3 || '0.00'),
    'totals_brought_forward.co_total_1': String(result.totals_brought_forward?.co_total_1 || '0.00'),
    'totals_brought_forward.co_total_2': String(result.totals_brought_forward?.co_total_2 || '0.00'),
    'totals_brought_forward.co_total_3': String(result.totals_brought_forward?.co_total_3 || '0.00'),
    'totals_brought_forward.withholding_total_1': String(result.totals_brought_forward?.withholding_total_1 || '0.00'),
    'totals_brought_forward.withholding_total_2': String(result.totals_brought_forward?.withholding_total_2 || '0.00'),
    'totals_brought_forward.withholding_total_3': String(result.totals_brought_forward?.withholding_total_3 || '0.00'),
    
    // Flattened individual column headers to prevent undefined values
    'mooe_col_1': String(result.mooe_col_1 || ''),
    'mooe_col_2': String(result.mooe_col_2 || ''),
    'mooe_col_3': String(result.mooe_col_3 || ''),
    'co_col_1': String(result.co_col_1 || ''),
    'co_col_2': String(result.co_col_2 || ''),
    'co_col_3': String(result.co_col_3 || ''),
    'withholding_col_1': String(result.withholding_col_1 || ''),
    'withholding_col_2': String(result.withholding_col_2 || ''),
    'withholding_col_3': String(result.withholding_col_3 || ''),
    
    // Flattened conditional flags to prevent undefined values
    'has_mooe_col_1': String(result.has_mooe_col_1 || 'false'),
    'has_mooe_col_2': String(result.has_mooe_col_2 || 'false'),
    'has_mooe_col_3': String(result.has_mooe_col_3 || 'false'),
    'has_co_col_1': String(result.has_co_col_1 || 'false'),
    'has_co_col_2': String(result.has_co_col_2 || 'false'),
    'has_co_col_3': String(result.has_co_col_3 || 'false'),
    'has_withholding_col_1': String(result.has_withholding_col_1 || 'false'),
    'has_withholding_col_2': String(result.has_withholding_col_2 || 'false'),
    'has_withholding_col_3': String(result.has_withholding_col_3 || 'false'),
  };
  
  console.log('Final RCB mapped data:', finalResult);
  console.log('Final validation - logo:', finalResult.logo);
  console.log('Final validation - quarter:', finalResult.quarter);
  console.log('Final validation - fund:', finalResult.fund);
  console.log('Final validation - treasurer_name:', finalResult.treasurer_name);
  console.log('Final validation - chairperson_name:', finalResult.chairperson_name);
  return finalResult;
}


