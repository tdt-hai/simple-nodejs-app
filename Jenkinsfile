pipeline {
    agent { label 'local-agent' }

    environment {
        // ── Docker Hub Registry 
        // Thay bằng username Docker Hub của bạn
        DOCKER_HUB_USER   = "tdthai"
        IMAGE_NAME        = "${DOCKER_HUB_USER}/simple-nodejs-app"
        IMAGE_TAG         = "${(env.GIT_BRANCH ?: env.BRANCH_NAME ?: 'local').replaceFirst('^origin/', '').replaceAll('/', '-')}-${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"

        // Credential ID lưu trong Jenkins (username = docker hub username, password = docker hub pat/password)
        REGISTRY_CREDS    = "dockerhub"

        // ── App / Deploy ─────────────────────────────────────────────────
        APP_PORT          = "8080"
        CONTAINER_NAME    = "simple-nodejs-app"
    }

    options {
        // Giữ tối đa 10 build logs
        buildDiscarder(logRotator(numToKeepStr: "10"))
        // Timeout toàn pipeline 30 phút
        timeout(time: 30, unit: "MINUTES")
        // Không chạy song song 2 build cùng lúc
        disableConcurrentBuilds()
        timestamps()
    }

    stages {

        // ── 1. CHECKOUT ───────────────────────────────────────────────────
        stage("Checkout") {
            steps {
                echo "Checking out source code..."
                checkout scm
                sh "git log -1 --oneline"
            }
        }

        // ── 2. BUILD + TEST (song song) ───────────────────────────────────
        stage("Build & Test") {
            parallel {

                stage("Build") {
                    steps {
                        echo "Building application..."
                        sh """
                            echo '--- BUILD MOCK ---'
                            echo 'npm ci && npm run build'
                            echo 'Build completed successfully .'
                        """
                    }
                    post {
                        failure {
                            echo "Build stage FAILED"
                        }
                    }
                }

                stage("Test") {
                    steps {
                        echo "Running tests..."
                        sh """
                            echo '--- TEST MOCK ---'
                            echo 'npm test -- --ci'
                            echo 'All tests passed.'
                        """
                    }
                    post {
                        always {
                            // Thu thập báo cáo test (nếu có JUnit XML)
                            // junit "target/surefire-reports/*.xml"
                            echo "Test results collected."
                        }
                        failure {
                            echo "Test stage FAILED"
                        }
                    }
                }

            } // end parallel
        }

        // ── 3. DOCKER BUILD ───────────────────────────────────────────────
        stage("Docker Build") {
            steps {
                echo "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
                sh """
                    docker build \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} .
                """
            }
            post {
                failure {
                    echo "Docker build FAILED – cleaning up dangling images..."
                    sh "docker image prune -f || true"
                }
            }
        }

        // ── 4. IMAGE PUSH to Docker Hub ──────────────────────────────────
        stage("Image Push") {
            steps {
                echo "Pushing image to Docker Hub..."
                withCredentials([usernamePassword(
                    credentialsId: "${REGISTRY_CREDS}",
                    usernameVariable: "REG_USER",
                    passwordVariable: "REG_PASS"
                )]) {
                    sh """
                        # Không truyền tên registry thì mặc định là Docker Hub (docker.io)
                        echo "${REG_PASS}" | docker login \
                            --username "${REG_USER}" \
                            --password-stdin

                        docker push ${IMAGE_NAME}:${IMAGE_TAG}

                        docker logout
                    """
                }
            }
            post {
                failure {
                    echo "Image push FAILED"
                }
            }
        }

        // ── 5. DEPLOY MOCK ────────────────────────────────────────────────
        stage("Deploy") {
            steps {
                echo "Deploying container using docker compose..."
                sh """
                    export IMAGE_NAME=${IMAGE_NAME}
                    export IMAGE_TAG=${IMAGE_TAG}

                    # Kéo image mới về (nếu dùng registry, còn build local thì bỏ qua bước pull)
                    # docker compose pull || true

                    # Dừng & xoá container cũ và chạy lại container mới
                    docker compose down || true
                    docker compose up -d

                    echo "Container is running with docker compose"
                    docker compose ps
                """
            }
            post {
                failure {
                    echo "Deploy FAILED – rolling back to previous stable release (latest)..."
                    sh """
                        export IMAGE_NAME=${IMAGE_NAME}
                        export IMAGE_TAG=latest
                        docker compose down || true
                        docker compose up -d || true
                    """
                }
            }
        }
        // ── 6. PROMOTE TO LATEST ──────────────────────────────────────────
        stage("Promote to Latest") {
            steps {
                echo "Deploy succeeded! Tagging current image as 'latest' and pushing..."
                withCredentials([usernamePassword(
                    credentialsId: "${REGISTRY_CREDS}",
                    usernameVariable: "REG_USER",
                    passwordVariable: "REG_PASS"
                )]) {
                    sh """
                        # Đăng nhập Docker Hub
                        echo "${REG_PASS}" | docker login \
                            --username "${REG_USER}" \
                            --password-stdin

                        # Đánh tag latest từ image vừa chạy thành công
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest

                        # Push latest lên Docker Hub
                        docker push ${IMAGE_NAME}:latest

                        docker logout
                    """
                }
            }
        }

    } // end stages

    // ── POST-PIPELINE ─────────────────────────────────────────────────────
    post {
        success {
            echo """
            ✅ Pipeline SUCCEEDED
            Image : ${IMAGE_NAME}:${IMAGE_TAG}
            Build : #${env.BUILD_NUMBER}
            """
        }
        failure {
            echo "❌ Pipeline FAILED – check logs above for details."
            // Gửi thông báo nếu cần:
            // slackSend channel: '#ci', message: "Build #${BUILD_NUMBER} failed!"
            // emailext to: 'team@example.com', subject: "Build failed: ${JOB_NAME}"
        }
        unstable {
            echo "⚠️  Pipeline UNSTABLE – some tests may have failed."
        }
        always {
            echo "Cleaning up workspace..."
            // Xoá image local sau build để tiết kiệm disk (tuỳ chọn)
            sh "docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true"
            cleanWs()
        }
    }
}