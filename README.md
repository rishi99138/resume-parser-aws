# AWS Resume Parser & Job Matcher
An intelligent serverless application that automatically parses resumes, extracts key information, and matches candidates to job descriptions.

## Features
- **Resume Parsing**: Extracts text from PDF/DOCX resumes using AWS Textract.
- **Skill Extraction**: Identifies technical and soft skills automatically.
- **Job Matching**: Calculates match percentage between resume and job description.
- **Gap Analysis**: Highlights missing skills and experience.
- **Serverless Architecture**: 100% serverless, scalable, and cost-effective.

## Architecture
- **Frontend**: S3 + CloudFront
- **API**: API Gateway + Lambda
- **Storage**: DynamoDB + S3
- **AI/ML**: AWS Textract

## Cost
Runs completely on AWS Free Tier (1000 Textract pages/month).

## Live Demo
[Add your CloudFront URL here]

## Contact
rishimandal99138@gmail.com
