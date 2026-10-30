import JSZip from 'jszip';

export async function createTableDocxWithExactHeight(hRule: 'exact' | 'atLeast' = 'exact'): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Document Header</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:trPr>
          <w:trHeight w:val="114" w:hRule="${hRule}"/>
        </w:trPr>
        <w:tc>
          <w:tcPr>
            <w:shd w:val="clear" w:color="auto" w:fill="F5F2EC"/>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:rPr><w:sz w:val="24"/></w:rPr>
              <w:t>Header Column 1</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:shd w:val="clear" w:color="auto" w:fill="F5F2EC"/>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:rPr><w:sz w:val="24"/></w:rPr>
              <w:t>Header Column 2</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:trPr>
          <w:trHeight w:val="114" w:hRule="${hRule}"/>
        </w:trPr>
        <w:tc>
          <w:p>
            <w:r>
              <w:rPr><w:sz w:val="24"/></w:rPr>
              <w:t>Data Row Cell 1</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p>
            <w:r>
              <w:rPr><w:sz w:val="24"/></w:rPr>
              <w:t>Data Row Cell 2</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
