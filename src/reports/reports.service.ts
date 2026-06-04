import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly db: DatabaseService) {}

  async createReport(params: {
    reportType: string;
    marketplaceIds: string[];
    sellerId: string;
    dataStartTime?: string;
    dataEndTime?: string;
  }): Promise<any> {
    const reportId = `RPT-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    await this.db.execute(
      `INSERT INTO sim_reports (report_id, seller_id, report_type, status)
       VALUES ($1, $2, $3, 'IN_QUEUE')`,
      [reportId, params.sellerId, params.reportType],
    );

    // Simulate async processing
    setTimeout(async () => {
      try {
        const documentId = `DOC-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
        await this.db.execute(
          `UPDATE sim_reports SET status = 'DONE', document_id = $1, updated_at = NOW()
           WHERE report_id = $2`,
          [documentId, reportId],
        );
      } catch (err) {
        this.logger.error(`Failed to complete report ${reportId}`, err);
      }
    }, 1000);

    return { reportId };
  }

  async getReport(reportId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_reports WHERE report_id = $1`,
      [reportId],
    );

    if (!row) {
      throw new NotFoundException(`Report not found: ${reportId}`);
    }

    return {
      reportId: row.report_id,
      reportType: row.report_type,
      processingStatus: row.status === 'DONE' ? 'DONE' : 'IN_QUEUE',
      reportDocumentId: row.document_id || undefined,
      createdTime: row.created_at,
      processingEndTime: row.status === 'DONE' ? row.updated_at : undefined,
    };
  }

  async getReportDocument(documentId: string): Promise<any> {
    const row = await this.db.queryOne(
      `SELECT * FROM sim_reports WHERE document_id = $1`,
      [documentId],
    );

    if (!row) {
      throw new NotFoundException(`Document not found: ${documentId}`);
    }

    // Return mock CSV content
    const content = this.generateReportContent(row.report_type, row.seller_id);

    return {
      reportDocumentId: documentId,
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`,
      compressionAlgorithm: 'GZIP',
    };
  }

  private generateReportContent(reportType: string, sellerId: string): string {
    if (reportType === 'GET_MERCHANT_LISTINGS_ALL_DATA') {
      return 'seller-sku\titem-name\tprice\tquantity\tstatus\n' +
        'SKU-001\tMock Product 1\t29.99\t100\tActive\n' +
        'SKU-002\tMock Product 2\t49.99\t50\tActive\n';
    }
    if (reportType === 'GET_FBA_INVENTORY_AGED_DATA') {
      return 'asin\tsku\tfulfillable-quantity\n' +
        'B0MOCK00001\tSKU-001\t100\n';
    }
    return `report_type=${reportType}\nseller_id=${sellerId}\ngenerated_at=${new Date().toISOString()}\n`;
  }
}
