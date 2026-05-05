const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');
const { authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const parseMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const packNotes = (notes, meta = {}) =>
  JSON.stringify({
    noteText: notes || '',
    ...meta,
  });

const unpackNotes = (notes) => {
  const parsed = parseMaybeJson(notes);
  if (parsed && typeof parsed === 'object') {
    return {
      noteText: parsed.noteText || '',
      ...parsed,
    };
  }
  return { noteText: notes || '' };
};

const toClientJob = (job) => {
  const notes = unpackNotes(job.notes);
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    issueDate: job.issueDate,
    fromLocation: job.fromLocation,
    dyeingHouse: job.dyeingHouse,
    workOrderNo: job.workOrderNo,
    lotNo: job.lotNo,
    quality: job.quality,
    colour: job.colour,
    greyThan: job.greyThan,
    greyMeters: job.greyMeters,
    attachmentUrl: notes.attachmentUrl,
    sourceLots: notes.sourceLots || [],
    deliverySchedules: notes.deliverySchedules || [],
    skipLForm: notes.skipLForm || false,
    notes: notes.noteText || '',
    status: job.status,
    createdBy: job.createdBy,
    createdAt: job.createdAt,
  };
};

const toClientReceive = (receive) => {
  const notes = unpackNotes(receive.notes);
  return {
    id: receive.id,
    receiveNumber: receive.receiveNumber,
    dyeingJobId: receive.dyeingJobId,
    lotNo: receive.lotNo,
    receiveDate: receive.receiveDate,
    dyeingName: receive.dyeingName,
    quality: receive.quality,
    colour: receive.colour,
    tiyarThan: receive.tiyarThan,
    tiyarMeters: receive.tiyarMeters,
    shortageThan: receive.shortageThan,
    shortageMeters: receive.shortageMeters,
    shortagePercent: receive.shortagePercent,
    deliveryNoteNo: receive.deliveryNoteNo,
    attachments: notes.attachments || [],
    thanDetails: notes.thanDetails || [],
    scheduledDeliveryDate: notes.scheduledDeliveryDate,
    notes: notes.noteText || '',
    createdBy: receive.createdBy,
    createdAt: receive.createdAt,
  };
};

const toClientLForm = (lform) => ({
  id: lform.id,
  lformNumber: lform.lformNumber,
  lotNo: lform.lotNo,
  dyeingReceiveId: lform.dyeingReceiveId,
  operationDate: lform.operationDate,
  operator: lform.operator,
  rows: lform.rows.map((row) => ({
    id: row.id,
    rowNumber: row.rowNumber,
    itemType: row.itemType,
    thanId: row.thanId,
    shade: row.shade,
    quality: row.quality,
    thanLength: row.thanLength,
    meterEquivalent: row.meterEquivalent,
    remarks: row.remarks || '',
  })),
  totalThans: lform.totalThans,
  totalMeters: lform.totalMeters,
  status: lform.status,
  finalizedBy: lform.finalizedBy || undefined,
  finalizedAt: lform.finalizedAt || undefined,
  createdBy: lform.createdBy,
  createdAt: lform.createdAt,
});

const toClientVoucher = (voucher) => ({
  id: voucher.id,
  voucherNumber: voucher.voucherNumber,
  voucherType: voucher.voucherType,
  lotNo: voucher.lotNo,
  lformId: voucher.lformId,
  transferDate: voucher.transferDate,
  warehouseId: voucher.warehouseId,
  lines: voucher.lines.map((line) => ({
    id: line.id,
    lineNumber: line.lineNumber,
    thanId: line.thanId || undefined,
    shade: line.shade,
    quality: line.quality,
    thanCount: line.thanCount,
    meters: line.meters,
    itemType: line.itemType,
    remarks: line.remarks || undefined,
  })),
  totalThans: voucher.totalThans,
  totalMeters: voucher.totalMeters,
  status: voucher.status,
  createdBy: voucher.createdBy,
  createdAt: voucher.createdAt,
  approvedBy: voucher.approvedBy || undefined,
  approvedAt: voucher.approvedAt || undefined,
});

router.get('/', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const [jobs, receives, lforms, vouchers] = await Promise.all([
      prisma.dyeingJob.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.dyeingReceive.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.lForm.findMany({ include: { rows: true }, orderBy: { createdAt: 'desc' } }),
      prisma.voucher.findMany({ include: { lines: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    return sendSuccess(
      res,
      {
        jobs: jobs.map(toClientJob),
        receives: receives.map(toClientReceive),
        lforms: lforms.map(toClientLForm),
        vouchers: vouchers.map(toClientVoucher),
      },
      'Dyeing flow data retrieved successfully'
    );
  } catch (error) {
    console.error('Get dyeing flow error:', error);
    return sendError(res, 'Failed to retrieve dyeing flow data', 500);
  }
});

router.post('/jobs', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const payload = req.body;
    const created = await prisma.dyeingJob.create({
      data: {
        jobNumber: payload.jobNumber,
        issueDate: new Date(payload.issueDate),
        fromLocation: payload.fromLocation,
        dyeingHouse: payload.dyeingHouse,
        workOrderNo: payload.workOrderNo,
        lotNo: payload.lotNo,
        quality: payload.quality,
        colour: payload.colour,
        greyThan: Number(payload.greyThan || 0),
        greyMeters: Number(payload.greyMeters || 0),
        status: payload.status || 'issued',
        notes: packNotes(payload.notes, {
          attachmentUrl: payload.attachmentUrl,
          sourceLots: payload.sourceLots || [],
          deliverySchedules: payload.deliverySchedules || [],
          skipLForm: !!payload.skipLForm,
        }),
        createdBy: userId,
      },
    });
    return sendSuccess(res, toClientJob(created), 'Dyeing job created successfully', 201);
  } catch (error) {
    console.error('Create dyeing job error:', error);
    return sendError(res, 'Failed to create dyeing job', 500);
  }
});

router.patch('/jobs/:id/status', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.dyeingJob.update({
      where: { id },
      data: { status },
    });
    return sendSuccess(res, toClientJob(updated), 'Dyeing job status updated successfully');
  } catch (error) {
    console.error('Update dyeing job status error:', error);
    return sendError(res, 'Failed to update dyeing job status', 500);
  }
});

router.delete('/jobs/:id', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.$transaction(async (tx) => {
      const receives = await tx.dyeingReceive.findMany({
        where: { dyeingJobId: id },
        select: { id: true },
      });
      const receiveIds = receives.map((r) => r.id);

      const lforms = await tx.lForm.findMany({
        where: { dyeingReceiveId: { in: receiveIds.length ? receiveIds : ['__none__'] } },
        select: { id: true },
      });
      const lformIds = lforms.map((l) => l.id);

      if (lformIds.length) {
        await tx.voucherLine.deleteMany({ where: { voucherId: { in: (await tx.voucher.findMany({ where: { lformId: { in: lformIds } }, select: { id: true } })).map(v => v.id) } } });
        await tx.voucher.deleteMany({ where: { lformId: { in: lformIds } } });
        await tx.lFormRow.deleteMany({ where: { lformId: { in: lformIds } } });
        await tx.lForm.deleteMany({ where: { id: { in: lformIds } } });
      }

      if (receiveIds.length) {
        await tx.dyeingReceive.deleteMany({ where: { id: { in: receiveIds } } });
      }
      await tx.dyeingJob.delete({ where: { id } });
    });
    return sendSuccess(res, null, 'Dyeing job and linked records deleted successfully');
  } catch (error) {
    console.error('Delete dyeing job error:', error);
    return sendError(res, 'Failed to delete dyeing job', 500);
  }
});

router.post('/receives', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const payload = req.body;
    const created = await prisma.dyeingReceive.create({
      data: {
        receiveNumber: payload.receiveNumber,
        dyeingJobId: payload.dyeingJobId,
        lotNo: payload.lotNo,
        receiveDate: new Date(payload.receiveDate),
        dyeingName: payload.dyeingName,
        quality: payload.quality,
        colour: payload.colour,
        tiyarThan: Number(payload.tiyarThan || 0),
        tiyarMeters: Number(payload.tiyarMeters || 0),
        shortageThan: Number(payload.shortageThan || 0),
        shortageMeters: Number(payload.shortageMeters || 0),
        shortagePercent: Number(payload.shortagePercent || 0),
        deliveryNoteNo: payload.deliveryNoteNo || null,
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        notes: packNotes(payload.notes, {
          thanDetails: payload.thanDetails || [],
          scheduledDeliveryDate: payload.scheduledDeliveryDate || null,
        }),
        createdBy: userId,
      },
    });
    return sendSuccess(res, toClientReceive(created), 'Dyeing receive created successfully', 201);
  } catch (error) {
    console.error('Create dyeing receive error:', error);
    return sendError(res, 'Failed to create dyeing receive', 500);
  }
});

router.post('/lforms', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const payload = req.body;
    const created = await prisma.lForm.create({
      data: {
        lformNumber: payload.lformNumber,
        lotNo: payload.lotNo,
        dyeingReceiveId: payload.dyeingReceiveId,
        operationDate: new Date(payload.operationDate),
        operator: payload.operator,
        totalThans: Number(payload.totalThans || 0),
        totalMeters: Number(payload.totalMeters || 0),
        status: payload.status || 'draft',
        finalizedBy: payload.status === 'finalized' ? userId : null,
        finalizedAt: payload.status === 'finalized' ? new Date() : null,
        createdBy: userId,
        rows: {
          create: (payload.rows || []).map((row) => ({
            rowNumber: row.rowNumber,
            itemType: row.itemType,
            thanId: row.thanId,
            shade: row.shade,
            quality: row.quality,
            thanLength: Number(row.thanLength || 0),
            meterEquivalent: Number(row.meterEquivalent || 0),
            remarks: row.remarks || null,
          })),
        },
      },
      include: { rows: true },
    });
    return sendSuccess(res, toClientLForm(created), 'L-Form created successfully', 201);
  } catch (error) {
    console.error('Create L-Form error:', error);
    return sendError(res, 'Failed to create L-Form', 500);
  }
});

router.post('/vouchers', authorize(['owner', 'warehouse', 'inventory_controller']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const payload = req.body;
    const created = await prisma.voucher.create({
      data: {
        voucherNumber: payload.voucherNumber,
        voucherType: payload.voucherType,
        lotNo: payload.lotNo,
        lformId: payload.lformId,
        transferDate: new Date(payload.transferDate),
        warehouseId: payload.warehouseId,
        totalThans: Number(payload.totalThans || 0),
        totalMeters: Number(payload.totalMeters || 0),
        status: payload.status || 'draft',
        createdBy: userId,
        approvedBy: payload.approvedBy || null,
        approvedAt: payload.approvedAt ? new Date(payload.approvedAt) : null,
        lines: {
          create: (payload.lines || []).map((line) => ({
            lineNumber: line.lineNumber,
            thanId: line.thanId || null,
            shade: line.shade,
            quality: line.quality,
            thanCount: Number(line.thanCount || 0),
            meters: Number(line.meters || 0),
            itemType: line.itemType,
            remarks: line.remarks || null,
          })),
        },
      },
      include: { lines: true },
    });
    return sendSuccess(res, toClientVoucher(created), 'Voucher created successfully', 201);
  } catch (error) {
    console.error('Create voucher error:', error);
    return sendError(res, 'Failed to create voucher', 500);
  }
});

module.exports = router;
