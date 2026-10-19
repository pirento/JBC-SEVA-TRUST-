const {
  authenticateAdmin,
} = require("../services/adminAuthService");

const {
  readRecords,
  appendRecord,
} = require("../models/fileStore");

const {
  getDailyReport,
} = require("../services/adminReportService");

const {
  listUsers,
} = require("../models/userModel");

const {
  goLiveChecks,
} = require("../services/configCheck");

const {
  buildExport,
  exportTypes,
} = require("../services/exportService");

const {
  listVolunteers,
  listMessages,
} = require("../models/enquiryModel");

const {
  donationPages,
  GENERAL_CAUSE,
} = require("../config/trustConfig");

const {
  generateDailyReportPdf,
} = require("../services/adminReportPdfService");

const {
  sendEmail,
} = require("../services/emailService");

const {
  user: adminEmail,
} = require("../config/emailConfig");


// ========================================
// SHOW ADMIN LOGIN
// ========================================

exports.showLogin = (req, res) => {
  if (
    req.session &&
    req.session.isAdmin === true
  ) {
    return res.redirect("/admin/dashboard");
  }

  return res.render("admin/login", {
    error: null,
  });
};


// ========================================
// ADMIN LOGIN
// ========================================

exports.login = async (req, res) => {
  try {
    const password = String(
      req.body.password || ""
    );

    if (!password) {
      return res.status(400).render(
        "admin/login",
        {
          error: "Password is required",
        }
      );
    }

    const result =
      await authenticateAdmin({
        password,
      });

    if (!result.success) {
      req.rateLimit?.hit();

      return res.status(401).render(
        "admin/login",
        {
          error: "Invalid admin password",
        }
      );
    }

    req.rateLimit?.reset();

    // ========================================
    // CREATE ADMIN SESSION
    // ========================================
    // New session id on login stops session fixation;
    // a logged-in website user stays logged in.

    const user = req.session.user;

    await new Promise((resolve, reject) =>
      req.session.regenerate((error) =>
        error ? reject(error) : resolve()
      )
    );

    if (user) {
      req.session.user = user;
    }

    req.session.isAdmin = true;

    req.session.adminLoginTime =
      new Date().toISOString();

    return res.redirect(
      "/admin/dashboard"
    );

  } catch (error) {
    console.error(
      "❌ Admin login error:",
      error.message
    );

    return res.status(500).render(
      "admin/login",
      {
        error:
          "Unable to process login",
      }
    );
  }
};


// ========================================
// COMMON RECORD DATE HELPER
// ========================================

function getRecordDate(record) {
  const dateValue =
    record.paymentDate ||
    record.submittedAt ||
    record.createdAt ||
    null;

  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


// ========================================
// NORMALIZE MEMBERSHIP RECORD
// ========================================

function normalizeMembershipRecord(record) {
  const item = {
    ...record,
  };


  // ========================================
  // SINGLE MEMBER
  // ========================================

  item.memberName =
    String(
      item.memberName ||
      item.donorName ||
      (
        Array.isArray(item.memberNames)
          ? item.memberNames[0]
          : ""
      ) ||
      ""
    ).trim();


  // ========================================
  // AMOUNT
  // ========================================

  item.amount =
    Number(item.amount) || 0;


  // ========================================
  // MEMBERSHIP TYPE
  // ========================================

  item.membershipType =
    String(
      item.membershipType || ""
    ).trim();

  if (!item.membershipType) {
    item.membershipType =
      item.amount >= 11000
        ? "Lifetime Member"
        : "1 Year Member";
  }


  // ========================================
  // PAYMENT STATUS
  // ========================================

  item.paymentStatus =
    String(
      item.paymentStatus ||
      "SUCCESS"
    ).trim();


  // ========================================
  // PAYMENT MODE
  // ========================================

  item.paymentMode =
    String(
      item.paymentMode ||
      "Online"
    ).trim();


  // ========================================
  // PAYMENT DATE
  // ========================================

  item.paymentDate =
    item.paymentDate || null;


  // ========================================
  // DISPLAY DATE
  // ========================================

  const date =
    getRecordDate(item);

  if (date) {

    item.displayDate =
      date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    item.displayTime =
      date.toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );

    item.sortDate =
      date.getTime();

  } else {

    item.displayDate =
      item.paymentDate
        ? String(item.paymentDate)
        : "-";

    item.displayTime = "";

    item.sortDate = 0;
  }


  // ========================================
  // TRANSACTION ID
  // ========================================

  item.transactionId =
    String(
      item.transactionId ||
      item.txnid ||
      ""
    ).trim();


  // ========================================
  // PAYU PAYMENT ID
  // ========================================

  item.payuPaymentId =
    String(
      item.payuPaymentId ||
      item.mihpayid ||
      ""
    ).trim();


  return item;
}


// ========================================
// NORMALIZE DONATION RECORD
// ========================================

function normalizeDonationRecord(record) {
  const item = {
    ...record,
  };


  // ========================================
  // DONOR
  // ========================================

  item.donorName =
    String(
      item.donorName || ""
    ).trim();


  // ========================================
  // CONTACT
  // ========================================

  item.phoneNumber =
    String(
      item.phoneNumber || ""
    ).trim();

  item.email =
    String(
      item.email || ""
    ).trim();


  // ========================================
  // AMOUNT
  // ========================================

  item.amount =
    Number(item.amount) || 0;


  // ========================================
  // PAYMENT MODE
  // ========================================

  item.paymentMode =
    String(
      item.paymentMode ||
      "Online"
    ).trim();


  // ========================================
  // PAYMENT STATUS
  // ========================================

  item.paymentStatus =
    String(
      item.paymentStatus ||
      "SUCCESS"
    ).trim();


  // ========================================
  // MESSAGE
  // ========================================

  item.message =
    String(
      item.message || ""
    ).trim();


  // ========================================
  // TRANSACTION ID
  // ========================================

  item.transactionId =
    String(
      item.transactionId ||
      item.txnid ||
      ""
    ).trim();


  // ========================================
  // PAYU PAYMENT ID
  // ========================================

  item.payuPaymentId =
    String(
      item.payuPaymentId ||
      item.mihpayid ||
      ""
    ).trim();


  // ========================================
  // PAYMENT DATE
  // ========================================

  item.paymentDate =
    item.paymentDate || null;


  // ========================================
  // DISPLAY DATE
  // ========================================

  const date =
    getRecordDate(item);

  if (date) {

    item.displayDate =
      date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    item.displayTime =
      date.toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );

    item.sortDate =
      date.getTime();

  } else {

    item.displayDate =
      item.paymentDate
        ? String(item.paymentDate)
        : "-";

    item.displayTime = "";

    item.sortDate = 0;
  }


  return item;
}


// ========================================
// NORMALIZE MEDICAL RECORD
// ========================================

function normalizeMedicalRecord(record) {
  const item = {
    ...record,
  };


  // ========================================
  // MEDICAL TYPE
  // ========================================

  item.type =
    item.type ||
    "MEDICAL_HELP";


  // ========================================
  // SUBMISSION DATE
  // ========================================

  item.submittedAt =
    item.submittedAt ||
    item.createdAt ||
    null;


  // ========================================
  // DISPLAY DATE & TIME
  // ========================================

  const date =
    getRecordDate(item);

  if (date) {

    item.displayDate =
      date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    item.displayTime =
      date.toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );

    item.sortDate =
      date.getTime();

  } else {

    item.displayDate = "-";
    item.displayTime = "";
    item.sortDate = 0;
  }


  return item;
}


// ========================================
// ADMIN DASHBOARD
// ========================================

exports.dashboard = async (
  req,
  res,
  next
) => {

  try {

    // ========================================
    // READ MEMBERSHIP DATA
    // ========================================

    const paymentRecords =
      await readRecords(
        "payment.txt"
      );


    // ========================================
    // READ DONATION DATA
    // ========================================

    const donationRecords =
      await readRecords(
        "donations.txt"
      );


    // ========================================
    // READ MEDICAL DATA
    // ========================================

    const medicalRecordsRaw =
      await readRecords(
        "user.txt"
      );


    // ========================================
    // NORMALIZE MEMBERSHIPS
    // ========================================

    const memberships =
      paymentRecords
        .map(
          normalizeMembershipRecord
        )
        .sort(
          (a, b) =>
            (b.sortDate || 0) -
            (a.sortDate || 0)
        );


    // ========================================
    // NORMALIZE DONATIONS
    // ========================================

    const donations =
      donationRecords
        .map(
          normalizeDonationRecord
        )
        .sort(
          (a, b) =>
            (b.sortDate || 0) -
            (a.sortDate || 0)
        );


    // ========================================
    // NORMALIZE MEDICAL RECORDS
    // ========================================

    const medicalRecords =
      medicalRecordsRaw
        .filter(
          (item) =>
            String(
              item?.type || ""
            ).toUpperCase() ===
            "MEDICAL_HELP"
        )
        .map(
          normalizeMedicalRecord
        )
        .sort(
          (a, b) =>
            (b.sortDate || 0) -
            (a.sortDate || 0)
        );


    // ========================================
    // SUCCESSFUL MEMBERSHIPS
    // ========================================

    const successfulMemberships =
      memberships.filter(
        (item) =>
          String(
            item.paymentStatus
          ).toUpperCase() ===
          "SUCCESS"
      );


    // ========================================
    // SUCCESSFUL DONATIONS
    // ========================================

    const successfulDonations =
      donations.filter(
        (item) =>
          String(
            item.paymentStatus
          ).toUpperCase() ===
          "SUCCESS"
      );


    // ========================================
    // MEMBERSHIP COUNT
    // ========================================

    const membershipCount =
      successfulMemberships.length;


    // ========================================
    // TOTAL MEMBERS
    // ========================================
    // Exactly one member per membership
    // transaction.

    const totalMembers =
      successfulMemberships.length;


    // ========================================
    // MEMBERSHIP COLLECTION
    // ========================================

    const membershipCollection =
      successfulMemberships.reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );


    // ========================================
    // LIFETIME MEMBERSHIPS
    // ========================================

    const lifetimeMemberships =
      successfulMemberships.filter(
        (item) =>
          String(
            item.membershipType
          ).toLowerCase() ===
          "lifetime member"
      );


    // ========================================
    // ONE YEAR MEMBERSHIPS
    // ========================================

    const oneYearMemberships =
      successfulMemberships.filter(
        (item) =>
          String(
            item.membershipType
          ).toLowerCase() ===
          "1 year member"
      );


    // ========================================
    // DONATION COUNT
    // ========================================

    const donationCount =
      successfulDonations.length;


    // ========================================
    // DONATION COLLECTION
    // ========================================

    const donationCollection =
      successfulDonations.reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );


    // ========================================
    // TOTAL COLLECTION
    // ========================================

    const totalCollection =
      membershipCollection +
      donationCollection;


    // ========================================
    // PAYMENT MODE STATISTICS
    // ========================================

    const membershipPaymentModeStats = {
      UPI: 0,
      Card: 0,
      "Net Banking": 0,
    };


    successfulMemberships.forEach(
      (membership) => {

        const mode =
          String(
            membership.paymentMode ||
            ""
          ).trim();

        if (
          Object.prototype.hasOwnProperty.call(
            membershipPaymentModeStats,
            mode
          )
        ) {
          membershipPaymentModeStats[
            mode
          ]++;
        }
      }
    );


    const donationPaymentModeStats = {
      UPI: 0,
      Card: 0,
      "Net Banking": 0,
    };


    successfulDonations.forEach(
      (donation) => {

        const mode =
          String(
            donation.paymentMode ||
            ""
          ).trim();

        if (
          Object.prototype.hasOwnProperty.call(
            donationPaymentModeStats,
            mode
          )
        ) {
          donationPaymentModeStats[
            mode
          ]++;
        }
      }
    );


    // ========================================
    // TODAY
    // ========================================

    const today =
      new Date();

    const todayDateString =
      today.toLocaleDateString(
        "en-IN"
      );


    // ========================================
    // TODAY'S MEMBERSHIPS
    // ========================================

    const todayMemberships =
      successfulMemberships.filter(
        (item) => {

          const date =
            getRecordDate(item);

          if (!date) {
            return false;
          }

          return (
            date.toLocaleDateString(
              "en-IN"
            ) ===
            todayDateString
          );
        }
      );


    // ========================================
    // TODAY'S DONATIONS
    // ========================================

    const todayDonations =
      successfulDonations.filter(
        (item) => {

          const date =
            getRecordDate(item);

          if (!date) {
            return false;
          }

          return (
            date.toLocaleDateString(
              "en-IN"
            ) ===
            todayDateString
          );
        }
      );


    // ========================================
    // TODAY'S MEDICAL HELP
    // ========================================

    const todayMedicalRecords =
      medicalRecords.filter(
        (item) => {

          const date =
            getRecordDate(item);

          if (!date) {
            return false;
          }

          return (
            date.toLocaleDateString(
              "en-IN"
            ) ===
            todayDateString
          );
        }
      );


    // ========================================
    // TODAY'S MEMBERSHIP COLLECTION
    // ========================================

    const todayMembershipCollection =
      todayMemberships.reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );


    // ========================================
    // TODAY'S DONATION COLLECTION
    // ========================================

    const todayDonationCollection =
      todayDonations.reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );


    // ========================================
    // TODAY'S TOTAL COLLECTION
    // ========================================

    const todayCollection =
      todayMembershipCollection +
      todayDonationCollection;


    // ========================================
    // RECENT MEMBERSHIPS
    // ========================================

    const recentMemberships =
      successfulMemberships.slice(
        0,
        10
      );


    // ========================================
    // RECENT DONATIONS
    // ========================================

    const recentDonations =
      successfulDonations.slice(
        0,
        10
      );


    // ========================================
    // RECENT MEDICAL RECORDS
    // ========================================

    const recentMedicalRecords =
      medicalRecords.slice(
        0,
        10
      );


    // ========================================
    // RENDER DASHBOARD
    // ========================================

    const registeredUsers =
      (await listUsers()).length;

    // One row per fund, in the order shown on the donate page
    const fundTotals =
      donationPages.map((page) => {
        const items = successfulDonations.filter(
          (d) => (d.cause || GENERAL_CAUSE) === page.title
        );

        return {
          cause: page.title,
          count: items.length,
          amount: items.reduce((total, d) => total + Number(d.amount || 0), 0),
        };
      });

    const volunteers =
      await listVolunteers();

    const messages =
      await listMessages();

    return res.render(
      "admin/dashboard",
      {

        registeredUsers,

        volunteers,

        messages,

        fundTotals,

        exportTypes,

        goLive: goLiveChecks(),

        // Membership
        memberships,

        recentMemberships,

        membershipCount,

        totalMembers,

        membershipCollection,

        lifetimeMemberships:
          lifetimeMemberships.length,

        oneYearMemberships:
          oneYearMemberships.length,


        // Donations
        donations,

        recentDonations,

        donationCount,

        donationCollection,


        // Combined
        totalCollection,


        // Today
        todayMemberships:
          todayMemberships.length,

        todayDonations:
          todayDonations.length,

        todayMedicalCount:
          todayMedicalRecords.length,

        todayMembershipCollection,

        todayDonationCollection,

        todayCollection,


        // Payment modes
        membershipPaymentModeStats,

        donationPaymentModeStats,


        // Medical
        medicalRecords,

        recentMedicalRecords,

        medicalCount:
          medicalRecords.length,
      }
    );

  } catch (error) {

    console.error(
      "❌ Admin dashboard error:",
      error.message
    );

    return next(error);
  }
};


// ========================================
// DAILY REPORT DOWNLOAD
// ========================================


    // ========================================
// DAILY REPORT DOWNLOAD + EMAIL
// ========================================

exports.downloadDailyReport = async (
  req,
  res,
  next
) => {
  try {
    const selectedDate =
      String(
        req.query.date || ""
      ).trim();

    // ========================================
    // VALIDATE DATE
    // ========================================

    if (!selectedDate) {
      return res.status(400).json({
        success: false,
        message:
          "Report date is required",
      });
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        selectedDate
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid report date",
      });
    }

    const selectedDateObject =
      new Date(
        `${selectedDate}T00:00:00`
      );

    if (
      Number.isNaN(
        selectedDateObject.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid report date",
      });
    }

    // ========================================
    // GET DAILY REPORT DATA
    // ========================================

    const report =
      await getDailyReport(
        selectedDate
      );

    // ========================================
    // GENERATE PDF
    // ========================================

    const pdfBuffer =
      await generateDailyReportPdf(
        report
      );

    if (
      !Buffer.isBuffer(pdfBuffer) ||
      pdfBuffer.length === 0
    ) {
      throw new Error(
        "Daily report PDF could not be generated"
      );
    }

    const fileName =
      `jbc-seva-daily-report-${selectedDate}.pdf`;

    // ========================================
    // CHECK EMAIL LOG
    // ========================================

    let emailAlreadySent = false;

    try {
      const emailRecords =
        await readRecords(
          "daily-report-email.txt"
        );

      emailAlreadySent =
        Array.isArray(emailRecords) &&
        emailRecords.some(
          (record) =>
            record &&
            String(
              record.reportDate || ""
            ).trim() === selectedDate &&
            String(
              record.emailStatus || ""
            ).trim().toUpperCase() ===
              "SENT"
        );

    } catch (error) {
      console.error(
        "⚠️ Unable to read daily report email log:",
        error.message
      );
    }

    // ========================================
    // SEND EMAIL
    // ========================================

    if (!emailAlreadySent) {
      try {
        const summary =
          report.summary || {};

        const membershipCount =
          Number(
            summary.membershipCount || 0
          );

        const membershipCollection =
          Number(
            summary.membershipCollection || 0
          );

        const donationCount =
          Number(
            summary.donationCount || 0
          );

        const donationCollection =
          Number(
            summary.donationCollection || 0
          );

        const medicalCount =
          Number(
            summary.medicalCount || 0
          );

        const totalCollection =
          Number(
            summary.totalCollection || 0
          );

        const formatMoney =
          (amount) =>
            `Rs. ${amount.toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`;

        await sendEmail({
          to: adminEmail,

          subject:
            `JBC Seva Trust - Daily Report - ${selectedDate}`,

          text: `JBC Seva Trust

Daily Administrative Report
Report Date: ${selectedDate}

Memberships: ${membershipCount}

Membership Collection:
${formatMoney(
  membershipCollection
)}

Donations: ${donationCount}

Donation Collection:
${formatMoney(
  donationCollection
)}

Medical Requests: ${medicalCount}

Total Collection:
${formatMoney(
  totalCollection
)}

The complete daily report PDF is attached with this email.

Regards,
JBC Seva Trust`,

          html: `
            <div
              style="
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #222;
              "
            >

              <h2>
                JBC Seva Trust
              </h2>

              <h3>
                Daily Administrative Report
              </h3>

              <p>
                <strong>
                  Report Date:
                </strong>
                ${selectedDate}
              </p>

              <hr>

              <p>
                <strong>
                  Memberships:
                </strong>
                ${membershipCount}
              </p>

              <p>
                <strong>
                  Membership Collection:
                </strong>
                ${formatMoney(
                  membershipCollection
                )}
              </p>

              <p>
                <strong>
                  Donations:
                </strong>
                ${donationCount}
              </p>

              <p>
                <strong>
                  Donation Collection:
                </strong>
                ${formatMoney(
                  donationCollection
                )}
              </p>

              <p>
                <strong>
                  Medical Requests:
                </strong>
                ${medicalCount}
              </p>

              <p>
                <strong>
                  Total Collection:
                </strong>
                ${formatMoney(
                  totalCollection
                )}
              </p>

              <hr>

              <p>
                The complete daily report PDF
                is attached with this email.
              </p>

              <p>
                Regards,<br>

                <strong>
                  JBC Seva Trust
                </strong>
              </p>

            </div>
          `,

          attachments: [
            {
              filename:
                fileName,

              content:
                pdfBuffer,

              contentType:
                "application/pdf",
            },
          ],
        });

        // ========================================
        // SAVE EMAIL STATUS
        // ========================================

        await appendRecord(
          "daily-report-email.txt",
          {
            type:
              "DAILY_REPORT_EMAIL",

            reportDate:
              selectedDate,

            emailStatus:
              "SENT",

            recipient:
              adminEmail,

            sentAt:
              new Date().toISOString(),
          }
        );

        console.log(
          "================================="
        );

        console.log(
          "✅ DAILY REPORT EMAIL SENT"
        );

        console.log(
          "📅 Report Date:",
          selectedDate
        );

        console.log(
          "📧 Recipient:",
          adminEmail
        );

        console.log(
          "================================="
        );

      } catch (emailError) {

        // Email fail hone par bhi
        // PDF download continue hoga.

        console.error(
          "⚠️ Daily report email failed:",
          emailError.message
        );
      }

    } else {

      console.log(
        `ℹ️ Daily report email already sent for ${selectedDate}`
      );

    }

    // ========================================
    // DOWNLOAD PDF
    // ========================================

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.setHeader(
      "Content-Length",
      pdfBuffer.length
    );

    return res.end(
      pdfBuffer
    );

  } catch (error) {

    console.error(
      "❌ Daily report download error:",
      error.message
    );

    return next(error);
  }
};
// ========================================
// ADMIN LOGOUT
// ========================================

// ========================================
// CSV EXPORT
// ========================================

exports.exportCsv = async (req, res, next) => {
  try {
    const csv = await buildExport(req.params.type);
    if (csv === null) return next();

    const date = new Date().toISOString().slice(0, 10);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.attachment(`jbc-${req.params.type}-${date}.csv`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};


exports.logout = (
  req,
  res
) => {

  req.session.destroy(
    (error) => {

      if (error) {

        console.error(
          "❌ Logout error:",
          error.message
        );

        return res
          .status(500)
          .send(
            "Unable to logout"
          );
      }


      res.clearCookie(
        "connect.sid"
      );

      return res.redirect(
        "/admin/login"
      );
    }
  );
};