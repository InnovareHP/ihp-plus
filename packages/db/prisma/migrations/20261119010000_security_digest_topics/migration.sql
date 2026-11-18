-- Marketing and IT topics IT can switch on or off, and issues written about a recent CISA alert.

-- AlterTable
ALTER TABLE "security"."securityDigestSettings" ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY['phishing', 'passwords', 'patient_data', 'devices', 'marketing_accounts', 'brand_spoofing', 'ai_tools', 'cloud_sharing']::TEXT[],
ADD COLUMN     "useAlerts" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "security"."securityDigestIssue" ADD COLUMN     "sourceTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sourceUrl" TEXT NOT NULL DEFAULT '';

