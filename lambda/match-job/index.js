const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function extractJobSkills(jobDescription) {
    // This is the same database as the other function
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
    const lowerText = jobDescription.toLowerCase();
    const foundSkills = [];
    Object.values(SKILLS_DATABASE).forEach(skills => {
        skills.forEach(skill => {
            if (lowerText.includes(skill.toLowerCase())) {
                foundSkills.push(skill);
            }
        });
    });
    return [...new Set(foundSkills)];
}

function calculateMatch(resumeSkills, jobSkills) {
    const resumeSet = new Set(resumeSkills.map(s => s.toLowerCase()));
    const jobSet = new Set(jobSkills.map(s => s.toLowerCase()));

    const matchedSkills = [...jobSet].filter(skill => resumeSet.has(skill));
    const missingSkills = [...jobSet].filter(skill => !resumeSet.has(skill));

    const matchPercentage = jobSet.size > 0
        ? Math.round((matchedSkills.length / jobSet.size) * 100)
        : 0;

    return {
        matchPercentage,
        matchedSkills,
        missingSkills,
        totalJobSkills: jobSet.size,
        totalResumeSkills: resumeSet.size
    };
}

function generateRecommendations(matchResult) {
    const { matchPercentage, missingSkills } = matchResult;
    const recommendations = [];

    if (matchPercentage < 50) {
        recommendations.push("Consider gaining more of the required skills before applying.");
    } else if (matchPercentage < 75) {
        recommendations.push("You're a decent match! Focus on highlighting relevant experience.");
    } else {
        recommendations.push("Excellent match! You should definitely apply.");
    }

    if (missingSkills.length > 0 && missingSkills.length <= 3) {
        recommendations.push(`Focus on learning: ${missingSkills.join(', ')}`);
    } else if (missingSkills.length > 3) {
        recommendations.push(`Key skills to develop: ${missingSkills.slice(0, 3).join(', ')} and ${missingSkills.length - 3} more.`);
    }
    return recommendations;
}

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    try {
        const body = JSON.parse(event.body);
        const { resumeId, jobDescription } = body;

        if (!resumeId || !jobDescription) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing resumeId or jobDescription' })
            };
        }

        // Get resume data from DynamoDB
        const params = {
            TableName: 'ResumeData',
            Key: { resumeId }
        };
        const result = await docClient.send(new GetCommand(params));

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Resume not found' })
            };
        }

        const resumeData = result.Item;
        const jobSkills = extractJobSkills(jobDescription);
        const matchResult = calculateMatch(resumeData.skills || [], jobSkills);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                resume: {
                    fileName: resumeData.fileName,
                    email: resumeData.email,
                    experience: resumeData.experience,
                    skills: resumeData.skills
                },
                match: matchResult,
                recommendations: generateRecommendations(matchResult)
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to match job',
                details: error.message
            })
        };
    }
};
