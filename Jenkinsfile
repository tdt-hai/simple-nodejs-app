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

        // Thêm đường dẫn helm, kubectl vào PATH cho Jenkins Agent
        PATH = "C:\\Users\\ThanhHai-PC\\AppData\\Local\\Microsoft\\WinGet\\Links;${env.PATH}"
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

        // ── 1. CHECKOUT ──────────────────────────────────────────────────
        stage("Checkout") {
            steps {
                echo "Checking out source code..."
                checkout scm
                bat "git log -1 --oneline"
            }
        }

        // ── 2. BUILD + TEST (song song) ───────────────────────────────────
        stage("Build & Test") {
            parallel {

                stage("Build") {
                    steps {
                        echo "Building application..."
                        bat """
                            echo "--- BUILD MOCK ---"
                            echo "npm ci && npm run build"
                            echo "Build completed successfully ."
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
                        bat """
                            echo "--- TEST MOCK ---"
                            echo "npm test -- --ci"
                            echo "All tests passed."
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
                bat """
                    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                """
            }
            post {
                failure {
                    echo "Docker build FAILED – cleaning up dangling images..."
                    bat "docker image prune -f || exit 0"
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
                    bat """
                        echo --- DEBUG CREDENTIALS ---
                        echo USER: [%REG_USER%]
                        echo PASS: [%REG_PASS%]
                        echo -------------------------

                        REM Không truyền tên registry thì mặc định là Docker Hub (docker.io)
                        docker login --username %REG_USER% --password %REG_PASS%

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

        // ── 5. DEPLOY docker(tắt làm lab k8s)
        // stage("Deploy") {
        //     steps {
        //         echo "Deploying container using docker compose..."
        //         bat """
        //             set IMAGE_NAME=${IMAGE_NAME}
        //             set IMAGE_TAG=${IMAGE_TAG}

        //             REM Kéo image mới về (nếu dùng registry, còn build local thì bỏ qua bước pull)
        //             REM docker compose pull || exit 0

        //             REM Dừng & xoá container cũ và chạy lại container mới
        //             docker compose down || exit 0
        //             docker compose up -d

        //             echo "Container is running with docker compose"
        //             docker compose ps
        //         """
        //     }
        //     post {
        //         failure {
        //             echo "Deploy FAILED – rolling back to previous stable release (latest)..."
        //             bat """
        //                 set IMAGE_NAME=${IMAGE_NAME}
        //                 set IMAGE_TAG=latest
        //                 docker compose down || exit 0
        //                 docker compose up -d || exit 0
        //             """
        //         }
        //     }
        // }
        // ── 6. PROMOTE TO LATEST ──────────────────────────────────────────
        stage("Promote to Latest") {
            steps {
                echo "Deploy succeeded! Tagging current image as 'latest' and pushing..."
                withCredentials([usernamePassword(
                    credentialsId: "${REGISTRY_CREDS}",
                    usernameVariable: "REG_USER",
                    passwordVariable: "REG_PASS"
                )]) {
                    bat """
                        echo --- DEBUG CREDENTIALS ---
                        echo USER: [%REG_USER%]
                        echo PASS: [%REG_PASS%]
                        echo -------------------------

                        REM Đăng nhập Docker Hub
                        docker login --username %REG_USER% --password %REG_PASS%

                        REM Đánh tag latest từ image vừa chạy thành công
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest

                        REM Push latest lên Docker Hub
                        docker push ${IMAGE_NAME}:latest

                        docker logout
                    """
                }
            }
        }

        // ── 7. DEPLOY K8S (Helm + Argo Rollouts Blue-Green) ────────────────
        stage("Deploy K8s") {
            steps {
                echo "Deploying to Kubernetes via Helm + Argo Rollouts (Blue-Green, zero-downtime)..."

                // Helm upgrade: lần đầu sẽ install, lần sau chỉ update image tag
                // Argo Rollouts tự động tạo preview ReplicaSet mới (green)
                // autoPromotionEnabled=true → tự promote active sau khi green healthy
                bat """
                    helm upgrade --install simple-nodejs-app ./helm ^
                        --namespace nodejs --create-namespace ^
                        --set image.repository=${IMAGE_NAME} ^
                        --set image.tag=${IMAGE_TAG} ^
                        --timeout 120s
                """

                // Chờ Argo Rollout hoàn tất blue-green switch
                bat "kubectl argo rollouts status nodejs-app-rollout -n nodejs --timeout 120s || exit 0"
            }
            post {
                success {
                    echo "✅ Deploy K8s succeeded (Blue-Green zero-downtime)!"
                    bat "kubectl argo rollouts get rollout nodejs-app-rollout -n nodejs"
                    bat "kubectl get svc -n nodejs"
                    bat "kubectl get ingress -n nodejs"
                }
                failure {
                    echo "❌ Deploy K8s FAILED – rolling back to previous revision..."
                    // Argo Rollouts undo: quay lại revision trước (không downtime)
                    bat "kubectl argo rollouts undo nodejs-app-rollout -n nodejs || exit 0"
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
            bat "docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || exit 0"
            cleanWs()
        }
    }
}