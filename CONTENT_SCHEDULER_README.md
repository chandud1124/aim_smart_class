# Content Scheduler - Advanced Features

## Overview
The Content Scheduler now supports advanced scheduling options, bulk import functionality, and media file uploads for managing display content across multiple boards.

## Content Types

### 1. Text Content (CSV/Excel Import)
- **Purpose**: Import scheduling data and text content in bulk
- **Use Case**: When you have lots of text-based announcements, notices, or schedules to manage
- **Benefits**: 
  - Bulk operations for hundreds of items
  - Structured data with scheduling rules
  - Easy to edit in spreadsheet software
  - Version control friendly

### 2. Media Files (Direct Upload)
- **Purpose**: Upload images, videos, audio, and documents for display
- **Use Case**: When you need to display rich media content like images, videos, or documents
- **Benefits**:
  - Direct file upload with automatic processing
  - Thumbnail generation for images
  - Metadata extraction
  - Support for various media formats

## When to Use CSV/Excel vs Media Upload

| Scenario | Use CSV Import | Use Media Upload |
|----------|----------------|------------------|
| Bulk text announcements | ✅ Primary choice | ❌ Not suitable |
| Schedule data with rules | ✅ Primary choice | ❌ Not suitable |
| Single image upload | ❌ Inefficient | ✅ Primary choice |
| Video content | ❌ No video data | ✅ Primary choice |
| Document display | ❌ No document data | ✅ Primary choice |
| Large batch operations | ✅ Primary choice | ❌ Limited to 10 files |
| Structured data management | ✅ Primary choice | ❌ No structured data |
| Quick file sharing | ❌ Requires CSV format | ✅ Primary choice |

## CSV/Excel Import Details

### Schedule Types
- **Always**: Content plays continuously without time restrictions
- **Fixed**: Content plays at a specific time on specific days
- **Recurring**: Content plays on a recurring schedule with customizable patterns

### Advanced Options

#### Date Range Control
- **Start Date**: When the content should begin playing
- **End Date**: When the content should stop playing
- **Exceptions**: Specific dates when content should NOT play (comma-separated, e.g., "2024-01-01, 2024-12-25")

#### Time Slot Management
- Add multiple time slots for the same content
- Each slot has independent start and end times
- Useful for content that needs to play at different times throughout the day

#### Enhanced Recurring Schedules
- **Days of Week**: Select specific days (0=Sunday, 1=Monday, etc.)
- **Frequency**: Daily, weekly, or monthly patterns
- **Time Slots**: Multiple time periods per day

## Bulk Import Functionality

### Supported File Formats
- CSV (.csv)
- Excel (.xlsx, .xls)

### CSV File Format
Your CSV file should contain the following columns:

```csv
title,content,type,priority,duration,schedule_type,start_time,end_time,days_of_week,assigned_boards,start_date,end_date,exceptions,is_active
```

### Column Descriptions

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| title | Yes | Content title | "Welcome Message" |
| content | Yes | The actual content to display | "Welcome to our school!" |
| type | No | Content type (default/user/emergency) | "user" |
| priority | No | Display priority (1-10) | "5" |
| duration | No | Display duration in seconds | "30" |
| schedule_type | No | Schedule type (always/fixed/recurring) | "recurring" |
| start_time | No | Start time (HH:MM) | "09:00" |
| end_time | No | End time (HH:MM) | "17:00" |
| days_of_week | No | Days to play (comma-separated numbers) | "1,2,3,4,5" |
| assigned_boards | Yes | Board names (comma-separated) | "Main Hall,Classroom A" |
| start_date | No | Start date (YYYY-MM-DD) | "2024-01-01" |
| end_date | No | End date (YYYY-MM-DD) | "2024-12-31" |
| exceptions | No | Exception dates (comma-separated) | "2024-01-01,2024-12-25" |
| is_active | No | Whether content is active (true/false) | "true" |

### Board Assignment
- Board names must match exactly with existing boards in the system
- Case-insensitive matching
- Multiple boards can be assigned by separating with commas

### Sample CSV Content

```csv
title,content,type,priority,duration,schedule_type,start_time,end_time,days_of_week,assigned_boards
Welcome Message,Welcome to our smart classroom system!,default,5,30,always,09:00,17:00,1,2,3,4,5,Main Hall Display
Morning Announcement,Good morning students! Have a great day of learning.,user,3,45,recurring,08:00,09:00,1,2,3,4,5,Classroom A,Classroom B
Emergency Alert,This is an emergency broadcast. Please evacuate immediately.,emergency,10,60,fixed,12:00,13:00,,All Boards
```

## Usage Instructions

### Creating Scheduled Content
1. Navigate to the Notice Board page
2. Click on the "Content Scheduler" tab
3. Click "Schedule Content" to open the creation dialog
4. Fill in the basic information (title, content, type, priority, duration)
5. Select a schedule type and configure the timing
6. Use the "Advanced Scheduling Options" section for:
   - Date ranges
   - Exception dates
   - Multiple time slots
7. Assign the content to specific display boards
8. Click "Schedule Content" to save

### Importing Content
1. Navigate to the Notice Board page
2. Click on the "Content Scheduler" tab
3. Click "Import Content" to open the import dialog
4. Select your CSV or Excel file
5. Click "Import Content" to process the file
6. Review any errors or warnings in the results

## Error Handling

### Import Errors
- **Missing required fields**: Title and content are mandatory
- **Invalid board names**: Board names must exist in the system
- **Invalid schedule types**: Must be "always", "fixed", or "recurring"
- **Invalid date formats**: Use YYYY-MM-DD format
- **Invalid time formats**: Use HH:MM format

### Validation Rules
- Priority: 1-10 (defaults to 1)
- Duration: 5-3600 seconds (defaults to 60)
- Days of week: 0-6 (Sunday = 0, Monday = 1, etc.)

## Media File Upload

### Supported File Types
- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, AVI, MOV, WMV
- **Audio**: MP3, WAV, M4A
- **Documents**: PDF, DOC, DOCX

### Features
- **Batch Upload**: Upload up to 10 files at once
- **File Size Limit**: 100MB per file
- **Automatic Processing**:
  - Thumbnail generation for images
  - Metadata extraction (dimensions, duration, etc.)
  - File type validation
- **Storage**: Files stored in `/uploads/media/` directory

### Usage Instructions

#### Uploading Media Files
1. Navigate to Notice Board → Content Scheduler tab
2. Click "Upload Media" button
3. Select multiple files (drag & drop or click to browse)
4. Click "Upload Files" to process
5. Files are automatically processed and stored

#### File Processing
- Images get automatic thumbnails (300x300px)
- Metadata is extracted and stored
- Files are renamed with timestamps for uniqueness
- URLs are generated for web access

### Integration with Content
After uploading media files, you can:
1. Reference them in scheduled content
2. Use them in display templates
3. Assign them to specific boards
4. Schedule their display times

## Best Practices

### For CSV Import
1. **Validate Data**: Always check your CSV in a spreadsheet first
2. **Board Names**: Ensure board names match exactly
3. **Date Formats**: Use YYYY-MM-DD format
4. **Batch Size**: Large files are processed in batches of 100

### For Media Upload
1. **File Names**: Use descriptive names before uploading
2. **File Sizes**: Compress large files when possible
3. **Formats**: Use web-optimized formats (WebP for images, MP4 for videos)
4. **Organization**: Upload related files together

### General Recommendations
- Use CSV import for **structured data** and **bulk operations**
- Use media upload for **rich content** and **individual files**
- Combine both: Import scheduling data via CSV, then upload associated media files
- Regular cleanup: Remove unused files to save storage space

## Troubleshooting

### Common Issues
- **Import fails**: Check file format and required columns
- **Boards not found**: Verify board names match existing boards
- **Invalid dates**: Ensure proper date/time formatting
- **No content displayed**: Check schedule settings and board assignments

### Logs
Check the server logs for detailed error information during import operations.