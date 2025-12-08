# Use nginx to serve static files
FROM nginx:alpine

# Copy all application files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Create nginx configuration for SPA with /nox/ base path
RUN echo 'server { \
    listen 80; \
    server_name n8n.misakirose.com; \
    \
    location /nox/ { \
        alias /usr/share/nginx/html/; \
        index index.html; \
        try_files $uri $uri/ /nox/index.html; \
    } \
    \
    location /nox { \
        return 301 /nox/; \
    } \
    \
    location / { \
        return 404; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
