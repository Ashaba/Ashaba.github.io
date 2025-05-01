function showPost(slug) {
    const posts = document.querySelectorAll(".blog-post");
    let found = false;

    posts.forEach(post => {
        if (post.id === slug) {
            post.style.display = "block";
            found = true;
        } else {
            post.style.display = "none";
        }
    });

    // Optional: fallback if invalid slug
    if (!found && posts.length > 0) {
        posts[0].style.display = "block";
    }
}

function handleHashChange() {
    const slug = location.hash.slice(1).trim();
    showPost(slug);
}

window.addEventListener("DOMContentLoaded", handleHashChange);
window.addEventListener("hashchange", handleHashChange);
