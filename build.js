const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

const config = {
    src: './src',
    content: './content',
    dist: './public',
    assets: './assets'
};

async function build() {
    console.log('🚀 Starting build...');

    // 1. Clean and setup dist
    await fs.emptyDir(config.dist);
    await fs.copy(config.assets, path.join(config.dist, 'assets'));

    // 2. Load Layout
    const layout = await fs.readFile(path.join(config.src, 'templates', 'layout.html'), 'utf-8');

    // 3. Process Static Pages (Home, About, etc.)
    const pagesDir = path.join(config.src, 'pages');
    if (await fs.pathExists(pagesDir)) {
        const pages = await fs.readdir(pagesDir);
        for (const page of pages) {
            if (path.extname(page) === '.html') {
                const content = await fs.readFile(path.join(pagesDir, page), 'utf-8');

                // Simple front-matter-like extraction for title if needed, 
                // or just hardcode title injection logic based on filename.
                let title = page.replace('.html', '');
                title = title.charAt(0).toUpperCase() + title.slice(1);
                if (title === 'Index') title = 'Home';

                // Root pages are at ./
                const rootPath = './';

                const html = layout
                    .replaceAll('{{title}}', title)
                    .replaceAll('{{rootPath}}', rootPath)
                    .replace('{{content}}', content);

                await fs.writeFile(path.join(config.dist, page), html);
                console.log(`✅ Built page: ${page}`);
            }
        }
    }

    // 4. Process Blog Posts
    const postsDir = path.join(config.content, 'posts');
    const posts = [];

    if (await fs.pathExists(postsDir)) {
        const postFiles = await fs.readdir(postsDir);

        for (const file of postFiles) {
            if (path.extname(file) === '.md') {
                const raw = await fs.readFile(path.join(postsDir, file), 'utf-8');
                const { attributes, body } = frontMatter(raw);
                const htmlContent = marked(body);

                // Used for linking internally
                const postUrl = `blog/${path.basename(file, '.md')}.html`;

                // Save for listing
                posts.push({
                    title: attributes.title || 'Untitled',
                    date: attributes.date || 'No Date',
                    description: attributes.description || '',
                    url: postUrl, // Relative from root
                    timestamp: new Date(attributes.date).getTime()
                });

                // Blog posts are in blog/ folder, so root is ../
                const rootPath = '../';

                // Wrap in layout
                const postHtml = `
                    <div class="container">
                        <article class="card" style="border:none; background: transparent;">
                            <h1 class="section-title" style="text-align:left; margin-bottom: 0.5rem;">${attributes.title}</h1>
                            <p style="color:var(--text-muted); margin-bottom: 2rem;">${attributes.date}</p>
                            <div class="prose">
                                ${htmlContent}
                            </div>
                            <br>
                            <a href="${rootPath}blog.html">← Back to Blog</a>
                        </article>
                    </div>
                `;

                const finalHtml = layout
                    .replaceAll('{{title}}', attributes.title)
                    .replaceAll('{{rootPath}}', rootPath)
                    .replace('{{content}}', postHtml);

                await fs.ensureDir(path.join(config.dist, 'blog'));
                await fs.writeFile(path.join(config.dist, 'blog', path.basename(file, '.md') + '.html'), finalHtml);
            } else {
                // Copy assets (images, etc.) directly to the blog folder
                await fs.ensureDir(path.join(config.dist, 'blog'));
                await fs.copy(path.join(postsDir, file), path.join(config.dist, 'blog', file));
                console.log(`📦 Copied asset: ${file}`);
            }
        }
    }

    // 5. Generate Blog Index
    posts.sort((a, b) => b.timestamp - a.timestamp); // Sort Newest First

    let blogListHtml = `
        <div class="container">
            <h1 class="section-title">Latest Updates</h1>
            <div class="grid">
    `;

    posts.forEach(post => {
        blogListHtml += `
            <div class="card">
                <h3><a href="${post.url}">${post.title}</a></h3>
                <p style="color:var(--primary-purple); font-size: 0.8rem; margin-bottom: 0.5rem;">${post.date}</p>
                <p>${post.description}</p>
                <br>
                <a href="${post.url}" class="btn" style="padding: 0.4rem 1rem; font-size: 0.8rem;">Read More</a>
            </div>
        `;
    });

    blogListHtml += `
            </div>
        </div>
    `;

    const blogPageHtml = layout
        .replaceAll('{{title}}', 'Blog')
        .replaceAll('{{rootPath}}', './')
        .replace('{{content}}', blogListHtml);

    await fs.writeFile(path.join(config.dist, 'blog.html'), blogPageHtml);
    console.log(`✅ Built Blog Index with ${posts.length} posts`);

    console.log('🎉 Build complete!');
}

build().catch(console.error);
