/**
 * Tesla LibreTV 代码质量检查和优化工具
 * 分析代码质量、性能问题和安全隐患
 */

class CodeQualityChecker {
    constructor() {
        this.issues = [];
        this.suggestions = [];
        this.metrics = {
            complexity: 0,
            maintainability: 0,
            performance: 0,
            security: 0
        };
        
        this.rules = {
            // 性能规则
            performance: [
                {
                    name: 'avoid_sync_operations',
                    pattern: /\.sync\(|synchronous/gi,
                    message: '避免使用同步操作，可能阻塞UI线程',
                    severity: 'warning'
                },
                {
                    name: 'optimize_dom_queries',
                    pattern: /document\.getElementById|document\.querySelector/g,
                    message: '频繁的DOM查询可能影响性能，考虑缓存元素引用',
                    severity: 'info'
                },
                {
                    name: 'avoid_memory_leaks',
                    pattern: /addEventListener(?!.*removeEventListener)/g,
                    message: '添加事件监听器后应在适当时机移除，避免内存泄漏',
                    severity: 'warning'
                }
            ],
            
            // 安全规则
            security: [
                {
                    name: 'avoid_eval',
                    pattern: /\beval\s*\(/g,
                    message: '避免使用eval()，存在代码注入风险',
                    severity: 'error'
                },
                {
                    name: 'validate_user_input',
                    pattern: /innerHTML\s*=.*\+|innerHTML\s*=.*\$\{/g,
                    message: '直接设置innerHTML可能导致XSS攻击，应验证和转义用户输入',
                    severity: 'warning'
                },
                {
                    name: 'secure_websocket',
                    pattern: /new\s+WebSocket\s*\(\s*['"]ws:/g,
                    message: '使用wss://而不是ws://以确保WebSocket连接安全',
                    severity: 'warning'
                }
            ],
            
            // 代码质量规则
            quality: [
                {
                    name: 'function_complexity',
                    pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g,
                    message: '函数过于复杂，考虑拆分为更小的函数',
                    severity: 'info',
                    check: (match) => {
                        const lines = match.split('\n').length;
                        return lines > 50;
                    }
                },
                {
                    name: 'magic_numbers',
                    pattern: /\b\d{4,}\b/g,
                    message: '使用常量替代魔法数字，提高代码可读性',
                    severity: 'info'
                },
                {
                    name: 'console_statements',
                    pattern: /console\.(log|warn|error|debug)/g,
                    message: '生产环境中应移除console语句或使用日志系统',
                    severity: 'info'
                }
            ],
            
            // Tesla特定规则
            tesla: [
                {
                    name: 'tesla_compatibility',
                    pattern: /navigator\.userAgent/g,
                    message: '检测Tesla车机环境时应考虑多个版本的User-Agent',
                    severity: 'info'
                },
                {
                    name: 'network_resilience',
                    pattern: /fetch\s*\(/g,
                    message: '网络请求应包含超时和重试机制，适应车机网络环境',
                    severity: 'warning'
                },
                {
                    name: 'resource_optimization',
                    pattern: /new\s+(Image|Audio|Video)/g,
                    message: '媒体资源应考虑Tesla车机的硬件限制，优化大小和格式',
                    severity: 'info'
                }
            ]
        };
    }
    
    /**
     * 分析单个文件
     */
    async analyzeFile(filePath, content) {
        console.log(`分析文件: ${filePath}`);
        
        const fileIssues = [];
        const fileMetrics = {
            lines: content.split('\n').length,
            functions: 0,
            complexity: 0
        };
        
        // 应用所有规则
        for (const [category, rules] of Object.entries(this.rules)) {
            for (const rule of rules) {
                const matches = content.match(rule.pattern);
                if (matches) {
                    for (const match of matches) {
                        // 如果有自定义检查函数，执行它
                        if (rule.check && !rule.check(match)) {
                            continue;
                        }
                        
                        const lineNumber = this.getLineNumber(content, match);
                        
                        fileIssues.push({
                            file: filePath,
                            rule: rule.name,
                            category: category,
                            message: rule.message,
                            severity: rule.severity,
                            line: lineNumber,
                            code: match.trim()
                        });
                    }
                }
            }
        }
        
        // 计算复杂度指标
        fileMetrics.functions = (content.match(/function\s+\w+|\w+\s*=\s*function|\w+\s*=>|class\s+\w+/g) || []).length;
        fileMetrics.complexity = this.calculateComplexity(content);
        
        this.issues.push(...fileIssues);
        
        return {
            file: filePath,
            issues: fileIssues,
            metrics: fileMetrics
        };
    }
    
    /**
     * 分析整个项目
     */
    async analyzeProject(projectPath) {
        console.log('开始项目代码质量分析...');
        
        const files = await this.getProjectFiles(projectPath);
        const results = [];
        
        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const result = await this.analyzeFile(file, content);
                results.push(result);
            } catch (error) {
                console.error(`分析文件失败: ${file}`, error);
            }
        }
        
        // 生成总体指标
        this.calculateOverallMetrics(results);
        
        // 生成改进建议
        this.generateSuggestions();
        
        return {
            summary: this.generateSummary(),
            files: results,
            issues: this.issues,
            suggestions: this.suggestions,
            metrics: this.metrics
        };
    }
    
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(projectPath) {
        // 在浏览器环境中，我们需要手动指定文件列表
        const files = [
            'tesla-proxy-server.js',
            'tesla-proxy-client.js',
            'tesla-comprehensive-test.html',
            'tesla-fallback-manager.js',
            'tesla-performance-monitor.js',
            'tesla-complete-test-suite.html',
            'tesla-automated-test.js',
            'tesla-test-runner.html'
        ];
        
        return files.map(file => `${projectPath}/${file}`);
    }
    
    /**
     * 读取文件内容
     */
    async readFile(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.warn(`无法读取文件: ${filePath}`);
            return '';
        }
    }
    
    /**
     * 获取代码行号
     */
    getLineNumber(content, searchText) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchText)) {
                return i + 1;
            }
        }
        return 1;
    }
    
    /**
     * 计算代码复杂度
     */
    calculateComplexity(content) {
        let complexity = 1; // 基础复杂度
        
        // 条件语句增加复杂度
        const conditionals = content.match(/\b(if|else if|switch|case|\?|&&|\|\|)\b/g) || [];
        complexity += conditionals.length;
        
        // 循环语句增加复杂度
        const loops = content.match(/\b(for|while|do)\b/g) || [];
        complexity += loops.length;
        
        // 异常处理增加复杂度
        const exceptions = content.match(/\b(try|catch|finally|throw)\b/g) || [];
        complexity += exceptions.length;
        
        return complexity;
    }
    
    /**
     * 计算总体指标
     */
    calculateOverallMetrics(results) {
        const totalLines = results.reduce((sum, r) => sum + r.metrics.lines, 0);
        const totalFunctions = results.reduce((sum, r) => sum + r.metrics.functions, 0);
        const totalComplexity = results.reduce((sum, r) => sum + r.metrics.complexity, 0);
        
        const errorCount = this.issues.filter(i => i.severity === 'error').length;
        const warningCount = this.issues.filter(i => i.severity === 'warning').length;
        
        // 计算质量分数 (0-100)
        this.metrics.complexity = Math.max(0, 100 - (totalComplexity / totalFunctions) * 2);
        this.metrics.maintainability = Math.max(0, 100 - (this.issues.length / totalLines) * 1000);
        this.metrics.performance = Math.max(0, 100 - warningCount * 5);
        this.metrics.security = Math.max(0, 100 - errorCount * 20 - warningCount * 5);
        
        this.metrics.overall = (
            this.metrics.complexity +
            this.metrics.maintainability +
            this.metrics.performance +
            this.metrics.security
        ) / 4;
    }
    
    /**
     * 生成改进建议
     */
    generateSuggestions() {
        const suggestions = [];
        
        // 基于问题类型生成建议
        const issuesByCategory = this.groupIssuesByCategory();
        
        if (issuesByCategory.performance && issuesByCategory.performance.length > 0) {
            suggestions.push({
                category: 'performance',
                priority: 'high',
                title: '性能优化建议',
                description: '发现多个性能相关问题，建议优化异步操作和DOM操作',
                actions: [
                    '使用async/await替代同步操作',
                    '缓存DOM元素引用',
                    '实现事件监听器的清理机制',
                    '考虑使用Web Workers处理重计算任务'
                ]
            });
        }
        
        if (issuesByCategory.security && issuesByCategory.security.length > 0) {
            suggestions.push({
                category: 'security',
                priority: 'critical',
                title: '安全加固建议',
                description: '发现安全相关问题，需要立即处理',
                actions: [
                    '移除或替换不安全的代码模式',
                    '实现输入验证和输出转义',
                    '使用安全的通信协议',
                    '添加内容安全策略(CSP)'
                ]
            });
        }
        
        if (issuesByCategory.tesla && issuesByCategory.tesla.length > 0) {
            suggestions.push({
                category: 'tesla',
                priority: 'medium',
                title: 'Tesla兼容性优化',
                description: '针对Tesla车机环境的特殊优化建议',
                actions: [
                    '增强网络连接的容错性',
                    '优化资源加载策略',
                    '适配不同Tesla车型的硬件差异',
                    '实现更智能的降级策略'
                ]
            });
        }
        
        // 基于代码指标生成建议
        if (this.metrics.complexity < 70) {
            suggestions.push({
                category: 'maintainability',
                priority: 'medium',
                title: '代码复杂度优化',
                description: '代码复杂度较高，建议重构以提高可维护性',
                actions: [
                    '拆分大型函数为更小的单元',
                    '减少嵌套层级',
                    '提取公共逻辑到工具函数',
                    '使用设计模式简化代码结构'
                ]
            });
        }
        
        this.suggestions = suggestions;
    }
    
    /**
     * 按类别分组问题
     */
    groupIssuesByCategory() {
        return this.issues.reduce((groups, issue) => {
            if (!groups[issue.category]) {
                groups[issue.category] = [];
            }
            groups[issue.category].push(issue);
            return groups;
        }, {});
    }
    
    /**
     * 生成摘要报告
     */
    generateSummary() {
        const totalIssues = this.issues.length;
        const criticalIssues = this.issues.filter(i => i.severity === 'error').length;
        const warningIssues = this.issues.filter(i => i.severity === 'warning').length;
        const infoIssues = this.issues.filter(i => i.severity === 'info').length;
        
        return {
            totalIssues,
            criticalIssues,
            warningIssues,
            infoIssues,
            overallScore: Math.round(this.metrics.overall),
            grade: this.getQualityGrade(this.metrics.overall),
            recommendations: this.suggestions.length
        };
    }
    
    /**
     * 获取质量等级
     */
    getQualityGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }
    
    /**
     * 生成HTML报告
     */
    generateHTMLReport(analysisResult) {
        const { summary, issues, suggestions, metrics } = analysisResult;
        
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tesla LibreTV 代码质量报告</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .grade-a { color: #28a745; }
        .grade-b { color: #17a2b8; }
        .grade-c { color: #ffc107; }
        .grade-d { color: #fd7e14; }
        .grade-f { color: #dc3545; }
        .section {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        .section h2 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .issue {
            background: #f8f9fa;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 0 5px 5px 0;
        }
        .issue.warning {
            border-left-color: #ffc107;
        }
        .issue.info {
            border-left-color: #17a2b8;
        }
        .issue-header {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .issue-details {
            font-size: 0.9em;
            color: #666;
        }
        .suggestion {
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 5px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .suggestion h3 {
            margin-top: 0;
            color: #0066cc;
        }
        .suggestion ul {
            margin-bottom: 0;
        }
        .priority-critical { border-left: 4px solid #dc3545; }
        .priority-high { border-left: 4px solid #fd7e14; }
        .priority-medium { border-left: 4px solid #ffc107; }
        .priority-low { border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 代码质量分析报告</h1>
            <p>Tesla LibreTV 项目质量评估</p>
            <p>生成时间: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric-card">
                <div class="metric-value grade-${summary.grade.toLowerCase()}">${summary.grade}</div>
                <div class="metric-label">总体评级</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.overallScore}</div>
                <div class="metric-label">质量分数</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.totalIssues}</div>
                <div class="metric-label">发现问题</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.recommendations}</div>
                <div class="metric-label">改进建议</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 详细指标</h2>
            <div class="summary">
                <div class="metric-card">
                    <div class="metric-value">${Math.round(metrics.complexity)}</div>
                    <div class="metric-label">复杂度分数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round(metrics.maintainability)}</div>
                    <div class="metric-label">可维护性</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round(metrics.performance)}</div>
                    <div class="metric-label">性能分数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round(metrics.security)}</div>
                    <div class="metric-label">安全分数</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🚨 发现的问题</h2>
            ${issues.map(issue => `
                <div class="issue ${issue.severity}">
                    <div class="issue-header">
                        ${issue.message}
                    </div>
                    <div class="issue-details">
                        文件: ${issue.file} | 行号: ${issue.line} | 类别: ${issue.category} | 严重程度: ${issue.severity}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="section">
            <h2>💡 改进建议</h2>
            ${suggestions.map(suggestion => `
                <div class="suggestion priority-${suggestion.priority}">
                    <h3>${suggestion.title}</h3>
                    <p>${suggestion.description}</p>
                    <ul>
                        ${suggestion.actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
        `;
    }
    
    /**
     * 导出报告
     */
    exportReport(analysisResult, format = 'html') {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        if (format === 'html') {
            const htmlContent = this.generateHTMLReport(analysisResult);
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `code-quality-report-${timestamp}.html`;
            a.click();
            
            URL.revokeObjectURL(url);
        } else if (format === 'json') {
            const jsonContent = JSON.stringify(analysisResult, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `code-quality-report-${timestamp}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeQualityChecker;
} else if (typeof window !== 'undefined') {
    window.CodeQualityChecker = CodeQualityChecker;
}

// 自动运行分析（如果直接在浏览器中加载）
if (typeof window !== 'undefined' && window.location) {
    window.runCodeQualityCheck = async function() {
        const checker = new CodeQualityChecker();
        try {
            console.log('开始代码质量分析...');
            const result = await checker.analyzeProject('.');
            console.log('代码质量分析完成:', result);
            
            // 导出HTML报告
            checker.exportReport(result, 'html');
            
            return result;
        } catch (error) {
            console.error('代码质量分析失败:', error);
            throw error;
        }
    };
}