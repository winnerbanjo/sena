"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingConfirmationEmail = sendBookingConfirmationEmail;
exports.sendBankTransferInstructionsEmail = sendBankTransferInstructionsEmail;
exports.sendPaymentReceiptEmail = sendPaymentReceiptEmail;
// Brand tokens & UI components
__exportStar(require("./components/brand"), exports);
__exportStar(require("./components/layout"), exports);
__exportStar(require("./components/elements"), exports);
// Templates
__exportStar(require("./templates/account"), exports);
__exportStar(require("./templates/reservation"), exports);
__exportStar(require("./templates/payment"), exports);
__exportStar(require("./templates/stay"), exports);
__exportStar(require("./templates/staff"), exports);
__exportStar(require("./templates/operations"), exports);
__exportStar(require("./templates/subscription"), exports);
__exportStar(require("./templates/security"), exports);
__exportStar(require("./templates/support"), exports);
__exportStar(require("./templates/editorial"), exports);
// Registry & Sender Engine
__exportStar(require("./registry"), exports);
__exportStar(require("./sender"), exports);
const sender_1 = require("./sender");
async function sendBookingConfirmationEmail(params) {
    return (0, sender_1.sendSenaEmail)('reservation.booking_confirmation', {
        guestName: params.guestName,
        reference: params.reference,
        propertyName: params.propertyName,
        propertyAddress: params.propertyAddress,
        propertyPhone: params.propertyPhone,
        roomType: params.roomType,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        nights: params.nights,
        totalAmountFormatted: params.totalAmountFormatted,
    }, {
        to: params.guestEmail,
        idempotencyKey: `booking_conf_${params.reference}`,
        relatedEntity: 'reservation',
        relatedId: params.reference,
    });
}
async function sendBankTransferInstructionsEmail(params) {
    return (0, sender_1.sendSenaEmail)('payment.bank_transfer_instructions', {
        guestName: params.guestName,
        reference: params.reference,
        propertyName: params.propertyName,
        bankName: params.bankName,
        accountNumber: params.accountNumber,
        accountName: params.accountName,
        amountFormatted: params.amountFormatted,
        whatsappContact: params.whatsappContact,
        propertyPhone: params.propertyPhone,
    }, {
        to: params.guestEmail,
        idempotencyKey: `bank_transfer_${params.reference}`,
        relatedEntity: 'reservation',
        relatedId: params.reference,
    });
}
async function sendPaymentReceiptEmail(params) {
    return (0, sender_1.sendSenaEmail)('payment.payment_received', {
        guestName: params.guestName,
        reference: params.reference,
        paymentReference: params.paymentReference,
        propertyName: params.propertyName,
        amountFormatted: params.amountFormatted,
        paymentMethod: params.paymentMethod,
        paidAt: params.paidAt,
    }, {
        to: params.guestEmail,
        idempotencyKey: `payment_receipt_${params.paymentReference}`,
        relatedEntity: 'payment',
        relatedId: params.paymentReference,
    });
}
