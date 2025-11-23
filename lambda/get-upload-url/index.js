const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    try {
        const body = JSON.parse(event.body);
        const { fileName, fileType } = body;

        if (!fileName || !fileType) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing fileName or fileType' })
            };
        }

        const key = `resumes/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });

        // Generate pre-signed URL valid for 5 minutes
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uploadUrl,
                key,
                bucket: BUCKET_NAME
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate upload URL',
                details: error.message
            })
        };
    }
};
