FROM amazon/aws-lambda-nodejs:14
COPY /layers/layer-core-executor/ /opt
COPY /layers/layer-framework-scraping/ /opt
RUN mkdir -p /opt/disable-extensions-jwigqn8j
CMD ["/opt/nodejs/executor.handler"]