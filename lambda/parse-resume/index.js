const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const textractClient = new TextractClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Comprehensive skill list
const SKILLS_DATABASE = {
    programming: ['python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab'],
    web: ['html', 'css', 'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'asp.net', 'next.js', 'nuxt.js'],
    mobile: ['android', 'ios', 'react native', 'flutter', 'xamarin', 'ionic'],
    cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'cloudformation', 'lambda', 's3', 'ec2', 'ecs', 'eks'],
    database: ['mysql', 'postgresql', 'mongodb', 'redis', 'dynamodb', 'cassandra', 'oracle', 'sql server', 'elasticsearch'],
    devops: ['jenkins', 'gitlab ci', 'github actions', 'circleci', 'travis ci', 'ansible', 'puppet', 'chef', 'prometheus', 'grafana'],
    ml: ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'nlp', 'computer vision', 'pandas', 'numpy'],
    tools: ['git', 'jira', 'confluence', 'slack', 'vscode', 'intellij', 'postman', 'swagger'],
    soft: ['leadership', 'communication', 'teamwork', 'problem solving', 'agile', 'scrum', 'project management']
};

function extractSkills(text) {
    const lowerText = text.toLowerCase();
    const foundSkills = [];
    Object.entries(SKILLS_DATABASE).forEach(([category, skills]) => {
        skills.forEach(skill => {
            if (lowerText.includes(skill.toLowerCase())) {
                foundSkills.push({ skill, category });
            }
        });
    });
    // Fix from PDF: This correctly de-duplicates while preserving category
    const uniqueSkills = new Map();
    foundSkills.forEach(s => {
        if (!uniqueSkills.has(s.skill)) {
            uniqueSkills.set(s.skill, s);
        }
    });
    return Array.from(uniqueSkills.values());
}

function extractEmail(text) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
}

function extractPhone(text) {
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    const match = text.match(phoneRegex);
    return match ? match[0] : null;
}

function extractExperience(text) {
    const expRegex = /(\d+)\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)/gi;
    const matches = text.match(expRegex);
    if (matches && matches.length > 0) {
        const numbers = matches[0].match(/\d+/);
        return numbers ? parseInt(numbers[0]) : 0;
    }
    return 0;
}

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    try {
        const body = JSON.parse(event.body);
        const { bucket, key } = body;
        if (!bucket || !key) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing bucket or key parameter' })
            };
        }

        // Get file from S3
        const s3Params = { Bucket: bucket, Key: key };
        const s3Response = await s3Client.send(new GetObjectCommand(s3Params));
        const fileBuffer = await streamToBuffer(s3Response.Body);

        // Use Textract to extract text
        const textractParams = {
            Document: { Bytes: fileBuffer }
        };
        const textractResponse = await textractClient.send(new DetectDocumentTextCommand(textractParams));

        // Extract full text
        const fullText = textractResponse.Blocks
            .filter(block => block.BlockType === 'LINE')
            .map(block => block.Text)
            .join('\n');

        // Extract information
        const extractedSkills = extractSkills(fullText);
post
        const email = extractEmail(fullText);
        const phone = extractPhone(fullText);
        const experience = extractExperience(fullText);

        // Generate unique ID
        const resumeId = `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Prepare resume data
        const resumeData = {
            resumeId,
            fileName: key,
            uploadDate: new Date().toISOString(),
            fullText,
            email,
            phone,
            experience,
            skills: extractedSkills.map(s => s.skill),
            skillsByCategory: extractedSkills.reduce((acc, { skill, category }) => {
                if (!acc[category]) acc[category] = [];
                acc[category].push(skill);
                return acc;
            }, {}),
            rawData: {
                totalSkills: extractedSkills.length,
                textLength: fullText.length
            }
        };

        // Save to DynamoDB
        const dynamoParams = {
            TableName: 'ResumeData',
            Item: resumeData
        };
        await docClient.send(new PutCommand(dynamoParams));

        // Return response
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                resumeId,
                data: resumeData
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to parse resume',
                details: error.message
            })
        };
    }
};

async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}
