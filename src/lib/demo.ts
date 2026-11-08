import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface DemoSpec {
  partnerLine?: string;
  awb: string;
  order: string;
  customer: string;
  city: string;
  pin: string;
  footer: string;
}

/** Draws one 4x6-inch style shipping label page. */
async function buildLabelPdf(specs: DemoSpec[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.11, 0.08);
  const soft = rgb(0.52, 0.49, 0.42);

  for (const s of specs) {
    const page = doc.addPage([430, 610]);
    page.drawRectangle({ x: 14, y: 14, width: 402, height: 582, borderColor: ink, borderWidth: 2 });
    page.drawRectangle({ x: 14, y: 508, width: 402, height: 88, color: rgb(0.95, 0.93, 0.87), borderColor: ink, borderWidth: 1 });

    page.drawText(s.partnerLine ?? "SHIPMENT LABEL", {
      x: 32, y: 560, size: s.partnerLine ? 27 : 22, font: bold, color: ink,
    });
    page.drawText("MEESHO SUPPLY PVT LTD", { x: 32, y: 536, size: 9, font: reg, color: soft });
    page.drawText("DOMESTIC SHIPMENT", { x: 32, y: 522, size: 9, font: reg, color: soft });

    const row = (label: string, value: string, y: number, valueSize = 11) => {
      page.drawText(label, { x: 32, y, size: 10, font: reg, color: soft });
      page.drawText(value, { x: 150, y, size: valueSize, font: bold, color: ink });
    };
    row("AWB No", s.awb, 480, 13);
    row("Order No", s.order, 458);
    row("Payment", "PREPAID", 436);
    row("Weight", "0.48 KG", 414);
    row("Service", "SURFACE", 392);

    page.drawText("SHIP TO", { x: 32, y: 356, size: 9, font: bold, color: soft });
    page.drawText(s.customer, { x: 32, y: 338, size: 12, font: bold, color: ink });
    page.drawText(`${s.city} - ${s.pin}`, { x: 32, y: 320, size: 11, font: reg, color: ink });
    page.drawText("India", { x: 32, y: 302, size: 11, font: reg, color: ink });

    page.drawText("FROM: Vastra Vibes, Surat, GJ", { x: 32, y: 268, size: 9, font: reg, color: soft });

    // pseudo barcode, deterministic per AWB
    let bx = 32;
    let seed = 7;
    for (let i = 0; i < s.awb.length; i++) seed = (seed * 31 + s.awb.charCodeAt(i)) % 9973;
    for (let i = 0; i < 46 && bx < 385; i++) {
      seed = (seed * 137 + 29) % 9973;
      const w = 1 + (seed % 4);
      page.drawRectangle({ x: bx, y: 140, width: w, height: 78, color: ink });
      bx += w + 2 + (seed % 3);
    }
    page.drawText(s.awb, { x: 32, y: 122, size: 10, font: reg, color: ink });
    page.drawText(s.footer, { x: 32, y: 42, size: 9, font: reg, color: soft });
    page.drawText("If undelivered, return to seller within 7 days.", { x: 32, y: 28, size: 8, font: reg, color: soft });
  }
  return doc.save();
}

/** Sample batch: 7 files / 12 labels across partners, incl. one mystery label. */
export async function makeDemoFiles(): Promise<File[]> {
  const defs: Array<{ name: string; specs: DemoSpec[] }> = [
    {
      name: "shadowfax_batch.pdf",
      specs: [
        { partnerLine: "Shadowfax", awb: "729301458821", order: "2088145671", customer: "Priya Sharma", city: "Bengaluru", pin: "560095", footer: "Shadowfax Technologies Pvt Ltd" },
        { partnerLine: "Shadowfax", awb: "729301458822", order: "2088145672", customer: "Rahul Verma", city: "Jaipur", pin: "302012", footer: "Shadowfax Technologies Pvt Ltd" },
        { partnerLine: "Shadowfax", awb: "729301458823", order: "2088145673", customer: "Ananya Das", city: "Kolkata", pin: "700032", footer: "Shadowfax Technologies Pvt Ltd" },
      ],
    },
    {
      name: "delhivery_0219.pdf",
      specs: [
        { partnerLine: "Delhivery", awb: "32049123456781", order: "2088251904", customer: "Vikram Singh", city: "Lucknow", pin: "226010", footer: "Delhivery Ltd - Surface" },
        { partnerLine: "Delhivery", awb: "32049123456782", order: "2088251905", customer: "Meera Iyer", city: "Chennai", pin: "600017", footer: "Delhivery Ltd - Surface" },
      ],
    },
    {
      name: "xpressbees.pdf",
      specs: [
        { partnerLine: "XpressBees", awb: "3457821990341", order: "2088377411", customer: "Arjun Mehta", city: "Pune", pin: "411057", footer: "XpressBees Supply Chain" },
        { partnerLine: "XpressBees", awb: "3457821990342", order: "2088377412", customer: "Sneha Kulkarni", city: "Nagpur", pin: "440022", footer: "XpressBees Supply Chain" },
      ],
    },
    {
      name: "ecom_express.pdf",
      specs: [
        { partnerLine: "Ecom Express", awb: "88231470965", order: "2088462208", customer: "Farhan Ali", city: "Hyderabad", pin: "500081", footer: "Ecom Express Pvt Ltd" },
      ],
    },
    {
      name: "bluedart.pdf",
      specs: [
        { partnerLine: "Blue Dart", awb: "78512349021", order: "2088509113", customer: "Kavita Nair", city: "Kochi", pin: "682020", footer: "Blue Dart Express Ltd" },
      ],
    },
    {
      name: "valmo_labels.pdf",
      specs: [
        { partnerLine: "ValmoPlus", awb: "VLM220914337", order: "2088702214", customer: "Ishaan Joshi", city: "Indore", pin: "452010", footer: "Valmo Commerce Pvt Ltd" },
        { partnerLine: "Valmo", awb: "VLM220914338", order: "2088702215", customer: "Tanvi Deshmukh", city: "Nashik", pin: "422009", footer: "Valmo Commerce Pvt Ltd" },
      ],
    },
    {
      name: "misc_shipment.pdf",
      specs: [
        { awb: "991204578345", order: "2088611227", customer: "Rohan Gupta", city: "Delhi", pin: "110034", footer: "Priority shipment - handle with care" },
      ],
    },
  ];

  const files: File[] = [];
  for (const d of defs) {
    const bytes = await buildLabelPdf(d.specs);
    files.push(new File([new Uint8Array(bytes)], d.name, { type: "application/pdf" }));
  }
  return files;
}
