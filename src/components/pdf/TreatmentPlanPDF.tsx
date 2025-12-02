import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import type { TreatmentItem, Location } from '@/types';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  // Cover Page Styles
  coverPage: {
    padding: 40,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  coverHeader: {
    marginBottom: 40,
  },
  coverTitle: {
    fontSize: 28,
    marginBottom: 8,
  },
  coverTitleHealth: {
    color: '#2dd4bf',
  },
  coverTitlePriority: {
    color: '#c084fc',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 20,
  },
  patientNameBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  patientName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
  },
  doctorSection: {
    marginTop: 20,
  },
  doctorLabel: {
    fontSize: 12,
    color: '#666',
  },
  doctorName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  // Table Page Styles
  tableHeader: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  introText: {
    fontSize: 11,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 8,
    minHeight: 40,
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  colItem: {
    width: '15%',
    fontSize: 9,
  },
  colDescription: {
    width: '50%',
    fontSize: 9,
    paddingRight: 8,
  },
  colTooth: {
    width: '15%',
    fontSize: 9,
    textAlign: 'center',
  },
  colFee: {
    width: '20%',
    fontSize: 9,
    textAlign: 'right',
  },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  totalRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f3f4f6',
    marginTop: 2,
  },
  totalLabel: {
    width: '80%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  totalAmount: {
    width: '20%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  footerTagline: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  footerLocations: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLocation: {
    width: '48%',
  },
  footerLocationName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 2,
  },
  footerLocationDetail: {
    fontSize: 8,
    color: '#666',
    marginBottom: 1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});

interface TreatmentPlanPDFProps {
  patientName: string;
  doctorName: string;
  location: Location;
  items: TreatmentItem[];
  totalAmount: number;
  coverBackground?: string;
  tableBackground?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};


// Cover Page Component
function CoverPage({
  patientName,
  doctorName,
  coverBackground,
}: {
  patientName: string;
  doctorName: string;
  coverBackground?: string;
}) {
  return (
    <Page size="A4" style={styles.coverPage}>
      {coverBackground && (
        <Image src={coverBackground} style={styles.backgroundImage} />
      )}
      {!coverBackground && (
        <>
          <View style={styles.coverHeader}>
            <Text style={styles.coverTitle}>
              <Text style={styles.coverTitleHealth}>Your Health, </Text>
              <Text style={styles.coverTitlePriority}>Our Priority</Text>
            </Text>
          </View>

          <Text style={styles.coverSubtitle}>
            A personalised treatment plan for:
          </Text>

          <View style={styles.patientNameBox}>
            <Text style={styles.patientName}>{patientName || 'Patient Name'}</Text>
          </View>

          <View style={styles.doctorSection}>
            <Text style={styles.doctorLabel}>Prepared by your Dentist:</Text>
            <Text style={styles.doctorName}>{doctorName || 'Doctor Name'}</Text>
          </View>
        </>
      )}
    </Page>
  );
}

// Table Page Component
function TablePage({
  items,
  totalAmount,
  location,
  tableBackground,
  isFirstPage = true,
}: {
  items: TreatmentItem[];
  totalAmount: number;
  location: Location;
  tableBackground?: string;
  isFirstPage?: boolean;
}) {
  // Location available for future use when customizing footer per location
  void location;

  return (
    <Page size="A4" style={styles.page}>
      {tableBackground && (
        <Image src={tableBackground} style={styles.backgroundImage} />
      )}

      {isFirstPage && (
        <>
          <Text style={styles.tableHeader}>Treatment Plan</Text>
          <Text style={styles.introText}>
            After a comprehensive review of your teeth, gums, oral tissues, we
            suggest the following:
          </Text>
        </>
      )}

      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colItem, styles.headerText]}>Item</Text>
          <Text style={[styles.colDescription, styles.headerText]}>
            Description
          </Text>
          <Text style={[styles.colTooth, styles.headerText]}>Tooth</Text>
          <Text style={[styles.colFee, styles.headerText]}>Fee</Text>
        </View>

        {/* Table Rows */}
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.colItem}>
              {item.itemCode ? `${item.itemCode}` : ''}
            </Text>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colTooth}>{item.tooth}</Text>
            <Text style={styles.colFee}>{formatCurrency(item.fee)}</Text>
          </View>
        ))}

        {/* Total Row */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT:</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerTagline}>
          We're obsessed with Oral Health, so you don't have to be!
        </Text>
        <View style={styles.footerLocations}>
          <View style={styles.footerLocation}>
            <Text style={styles.footerLocationName}>Essendon</Text>
            <Text style={styles.footerLocationDetail}>siadental.com.au</Text>
            <Text style={styles.footerLocationDetail}>(03) 9289 3999</Text>
            <Text style={styles.footerLocationDetail}>
              1138-1140 Mt Alexander Rd, Essendon, VIC 3040
            </Text>
          </View>
          <View style={styles.footerLocation}>
            <Text style={styles.footerLocationName}>Burwood</Text>
            <Text style={styles.footerLocationDetail}>
              siadentalburwood.com.au
            </Text>
            <Text style={styles.footerLocationDetail}>(03) 8538 6199</Text>
            <Text style={styles.footerLocationDetail}>
              138-140 Burwood Hwy, Burwood, VIC 3125
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// Main PDF Document
export function TreatmentPlanPDF({
  patientName,
  doctorName,
  location,
  items,
  totalAmount,
  coverBackground,
  tableBackground,
}: TreatmentPlanPDFProps) {
  // Filter out empty items
  const validItems = items.filter((item) => item.itemCode || item.description);

  // Split items into pages if needed (max 8 items per page for readability)
  const itemsPerPage = 8;
  const pages: TreatmentItem[][] = [];

  for (let i = 0; i < validItems.length; i += itemsPerPage) {
    pages.push(validItems.slice(i, i + itemsPerPage));
  }

  // Ensure at least one page
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <Document>
      <CoverPage
        patientName={patientName}
        doctorName={doctorName}
        coverBackground={coverBackground}
      />
      {pages.map((pageItems, index) => (
        <TablePage
          key={index}
          items={pageItems}
          totalAmount={index === pages.length - 1 ? totalAmount : 0}
          location={location}
          tableBackground={tableBackground}
          isFirstPage={index === 0}
        />
      ))}
    </Document>
  );
}

